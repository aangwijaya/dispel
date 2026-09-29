-- Facts and per-source health for the market read (Phase 6: derivatives + on-chain).
-- The composed payload in `read` is unchanged; these columns are for auditing/calibration.

alter table public.market_reads
  add column inputs_health jsonb not null default '{}'::jsonb,
  add column inputs jsonb not null default '{}'::jsonb;

comment on column public.market_reads.inputs_health is
  'Per-source health for this read (probe style: ok, http_status, latency_ms per check).';
comment on column public.market_reads.inputs is
  'Computed derivatives and on-chain facts used by this read, for audit and calibration.';
