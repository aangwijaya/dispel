-- Crypto paper transfers: extend the ledger and add a simulated transfer RPC.
alter table public.transactions
  add column asset text not null default 'USDT' check (asset ~ '^[A-Z0-9]{2,10}$'),
  add column network text,
  add column address text,
  add constraint transactions_transfer_details check ((network is null) = (address is null));

-- Simulated deposit/withdraw of a base asset. No on-chain movement, no keys.
create or replace function public.transfer_paper_crypto(
  p_symbol text,
  p_asset text,
  p_kind text,
  p_quantity numeric,
  p_network text,
  p_address text,
  p_reference_price numeric
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_position public.paper_positions;
  v_quantity numeric(38, 18);
  v_balance_after numeric(38, 18);
  v_transaction public.transactions;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{5,20}$' or right(p_symbol, 4) <> 'USDT' then
    raise exception 'invalid_symbol';
  end if;
  if p_asset is null or p_asset !~ '^[A-Z0-9]{2,10}$'
    or p_asset <> left(p_symbol, length(p_symbol) - 4) then
    raise exception 'invalid_asset';
  end if;
  if p_kind not in ('deposit', 'withdraw') then
    raise exception 'invalid_transaction_kind';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000000000000 then
    raise exception 'invalid_quantity';
  end if;
  if p_network is null or p_network !~ '^[A-Za-z0-9 -]{2,32}$' then
    raise exception 'invalid_network';
  end if;
  if p_address is null or p_address !~ '^[A-Za-z0-9]{8,128}$' then
    raise exception 'invalid_address';
  end if;
  if p_kind = 'deposit'
    and (p_reference_price is null or p_reference_price <= 0 or p_reference_price > 1000000000000) then
    raise exception 'invalid_reference_price';
  end if;

  v_quantity := round(p_quantity, 8);
  if v_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  if p_kind = 'deposit' then
    insert into public.paper_positions (user_id, symbol, quantity, avg_entry_price)
    values (v_user_id, p_symbol, v_quantity, p_reference_price)
    on conflict (user_id, symbol) do update
    set avg_entry_price = round(
          (public.paper_positions.quantity * public.paper_positions.avg_entry_price
            + excluded.quantity * excluded.avg_entry_price)
          / (public.paper_positions.quantity + excluded.quantity), 8),
        quantity = public.paper_positions.quantity + excluded.quantity,
        updated_at = now();
  else
    select * into v_position
    from public.paper_positions
    where user_id = v_user_id and symbol = p_symbol
    for update;

    if not found or v_position.quantity < v_quantity then
      raise exception 'insufficient_position';
    end if;

    update public.paper_positions
    set quantity = quantity - v_quantity,
        updated_at = now()
    where user_id = v_user_id and symbol = p_symbol;
  end if;

  select quantity into v_balance_after
  from public.paper_positions
  where user_id = v_user_id and symbol = p_symbol;

  insert into public.transactions (user_id, kind, asset, amount, balance_after, network, address)
  values (v_user_id, p_kind, p_asset, v_quantity, v_balance_after, p_network, p_address)
  returning * into v_transaction;

  return v_transaction;
end;
$$;

revoke all on function public.transfer_paper_crypto(text, text, text, numeric, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.transfer_paper_crypto(text, text, text, numeric, text, text, numeric)
  to authenticated;
