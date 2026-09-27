-- Market read snapshots produced by the market-read Edge Function (TypeSafe Jev).
-- The client reads the latest row; only the service role writes.

create table public.market_reads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  as_of timestamptz not null,
  status text not null default 'ok' check (status in ('ok', 'degraded')),
  model text not null,
  read jsonb not null,
  answers jsonb not null,
  usage jsonb not null
);

create index market_reads_created_at_idx on public.market_reads (created_at desc);

alter table public.market_reads enable row level security;

create policy "market_reads_select_authenticated"
  on public.market_reads
  for select
  to authenticated
  using (true);

comment on table public.market_reads is
  'Jev market read snapshots. read = market-wide MarketRead payload, answers = raw Jev answers for audit, status = ok | degraded.';
