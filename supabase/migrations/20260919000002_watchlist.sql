-- Single watchlist per user. Symbols are Binance market symbols, e.g. BTCUSDT.
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{5,20}$'),
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

alter table public.watchlist_items enable row level security;

create policy "watchlist_items_select_own"
  on public.watchlist_items
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "watchlist_items_insert_own"
  on public.watchlist_items
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "watchlist_items_delete_own"
  on public.watchlist_items
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
