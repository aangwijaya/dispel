-- Paper fund movements (deposits / withdrawals) with a ledger.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'withdraw')),
  amount numeric(24, 8) not null check (amount > 0),
  balance_after numeric(24, 8) not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index transactions_user_created_idx on public.transactions (user_id, created_at desc);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Adjust the paper cash balance and record the movement in one transaction.
create or replace function public.adjust_paper_funds(p_kind text, p_amount numeric)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.paper_accounts;
  v_balance numeric(24, 8);
  v_transaction public.transactions;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind not in ('deposit', 'withdraw') then
    raise exception 'invalid_transaction_kind';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then
    raise exception 'invalid_amount';
  end if;

  select * into v_account
  from public.paper_accounts
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'account_not_found';
  end if;

  if p_kind = 'deposit' then
    v_balance := v_account.cash_balance + round(p_amount, 8);
  else
    if v_account.cash_balance < p_amount then
      raise exception 'insufficient_balance';
    end if;
    v_balance := v_account.cash_balance - round(p_amount, 8);
  end if;

  update public.paper_accounts
  set cash_balance = v_balance,
      updated_at = now()
  where user_id = v_user_id;

  insert into public.transactions (user_id, kind, amount, balance_after)
  values (v_user_id, p_kind, round(p_amount, 8), v_balance)
  returning * into v_transaction;

  return v_transaction;
end;
$$;

revoke all on function public.adjust_paper_funds(text, numeric) from public, anon, authenticated;
grant execute on function public.adjust_paper_funds(text, numeric) to authenticated;
