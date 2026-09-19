-- Paper positions and orders. All money math happens here, never in the client.
create table public.paper_positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{5,20}$'),
  quantity numeric(38, 18) not null default 0 check (quantity >= 0),
  avg_entry_price numeric(24, 8) not null default 0 check (avg_entry_price >= 0),
  realized_pnl numeric(24, 8) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.paper_positions enable row level security;

create policy "paper_positions_select_own"
  on public.paper_positions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{5,20}$'),
  side text not null check (side in ('buy', 'sell')),
  type text not null check (type in ('market', 'limit')),
  limit_price numeric(24, 8) check (limit_price is null or limit_price > 0),
  filled_avg_price numeric(24, 8) check (filled_avg_price is null or filled_avg_price > 0),
  quantity numeric(38, 18) not null check (quantity > 0),
  filled_quantity numeric(38, 18) not null default 0 check (filled_quantity >= 0),
  fee numeric(24, 8) not null default 0 check (fee >= 0),
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled')),
  filled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_limit_price_required check ((type = 'limit') = (limit_price is not null)),
  constraint orders_filled_quantity_bounds check (filled_quantity <= quantity)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_user_status_idx on public.orders (user_id, status);

alter table public.orders enable row level security;

create policy "orders_select_own"
  on public.orders
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Internal settlement: moves cash, updates the position and closes the order.
create or replace function public.settle_order_fill(p_order_id uuid, p_fill_price numeric)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
  v_cash numeric(24, 8);
  v_position public.paper_positions;
  v_gross numeric;
  v_fee numeric;
  v_fee_rate constant numeric := 0.001;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_fill_price is null or p_fill_price <= 0 or p_fill_price > 1000000000000 then
    raise exception 'invalid_price';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status <> 'open' then
    raise exception 'order_not_open';
  end if;

  v_gross := round(v_order.quantity * p_fill_price, 8);
  v_fee := round(v_gross * v_fee_rate, 8);

  if v_order.side = 'buy' then
    select cash_balance into v_cash
    from public.paper_accounts
    where user_id = v_user_id
    for update;

    if v_cash is null then
      raise exception 'account_not_found';
    end if;
    if v_cash < v_gross + v_fee then
      raise exception 'insufficient_balance';
    end if;

    update public.paper_accounts
    set cash_balance = cash_balance - v_gross - v_fee,
        updated_at = now()
    where user_id = v_user_id;

    insert into public.paper_positions (user_id, symbol, quantity, avg_entry_price)
    values (v_user_id, v_order.symbol, v_order.quantity, p_fill_price)
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
    where user_id = v_user_id and symbol = v_order.symbol
    for update;

    if not found or v_position.quantity < v_order.quantity then
      raise exception 'insufficient_position';
    end if;

    update public.paper_accounts
    set cash_balance = cash_balance + v_gross - v_fee,
        updated_at = now()
    where user_id = v_user_id;

    update public.paper_positions
    set quantity = quantity - v_order.quantity,
        realized_pnl = round(realized_pnl + (p_fill_price - avg_entry_price) * v_order.quantity, 8),
        updated_at = now()
    where user_id = v_user_id and symbol = v_order.symbol;
  end if;

  update public.orders
  set status = 'filled',
      filled_quantity = quantity,
      filled_avg_price = p_fill_price,
      fee = v_fee,
      filled_at = now(),
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.settle_order_fill(uuid, numeric) from public, anon, authenticated;

-- Place a market order (fills immediately at the reference price) or a limit order.
create or replace function public.place_order(
  p_symbol text,
  p_side text,
  p_type text,
  p_price numeric,
  p_quantity numeric,
  p_reference_price numeric
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{5,20}$' then
    raise exception 'invalid_symbol';
  end if;
  if p_side not in ('buy', 'sell') then
    raise exception 'invalid_side';
  end if;
  if p_type not in ('market', 'limit') then
    raise exception 'invalid_type';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000000000000 then
    raise exception 'invalid_quantity';
  end if;
  if p_type = 'limit' then
    if p_price is null or p_price <= 0 or p_price > 1000000000000 then
      raise exception 'invalid_price';
    end if;
  else
    if p_price is not null then
      raise exception 'invalid_price';
    end if;
    if p_reference_price is null or p_reference_price <= 0 or p_reference_price > 1000000000000 then
      raise exception 'invalid_reference_price';
    end if;
  end if;
  if p_quantity * coalesce(p_price, p_reference_price) < 1 then
    raise exception 'notional_too_small';
  end if;

  insert into public.orders (user_id, symbol, side, type, limit_price, quantity)
  values (v_user_id, p_symbol, p_side, p_type, case when p_type = 'limit' then p_price else null end, p_quantity)
  returning * into v_order;

  if p_type = 'market' then
    v_order := public.settle_order_fill(v_order.id, p_reference_price);
  end if;

  return v_order;
end;
$$;

revoke all on function public.place_order(text, text, text, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, numeric, numeric, numeric) to authenticated;

-- Fill an open limit order when the live market price crosses its limit.
create or replace function public.fill_order(p_order_id uuid, p_fill_price numeric)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_fill_price is null or p_fill_price <= 0 or p_fill_price > 1000000000000 then
    raise exception 'invalid_price';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status <> 'open' then
    raise exception 'order_not_open';
  end if;
  if v_order.type <> 'limit' then
    raise exception 'invalid_type';
  end if;
  if (v_order.side = 'buy' and p_fill_price > v_order.limit_price)
    or (v_order.side = 'sell' and p_fill_price < v_order.limit_price) then
    raise exception 'limit_not_crossed';
  end if;

  return public.settle_order_fill(p_order_id, p_fill_price);
end;
$$;

revoke all on function public.fill_order(uuid, numeric) from public, anon, authenticated;
grant execute on function public.fill_order(uuid, numeric) to authenticated;

-- Cancel an open order.
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status <> 'open' then
    raise exception 'order_not_open';
  end if;

  update public.orders
  set status = 'cancelled',
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
