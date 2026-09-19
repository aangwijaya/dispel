-- Paper trading account per user, created automatically on sign-up.
create table public.paper_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cash_balance numeric(24, 8) not null default 100000 check (cash_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paper_accounts enable row level security;

create policy "paper_accounts_select_own"
  on public.paper_accounts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Balances are mutated only through security definer functions.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.paper_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
