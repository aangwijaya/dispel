-- Public read-only projection of the latest market read, for unauthenticated previews (Sign in).
-- The view runs with the owner's rights, so anon can read this projection without any grant on the
-- table; public.market_reads keeps its authenticated-only RLS. Only payload columns are exposed:
-- answers and usage stay private.

create or replace view public.market_read_latest as
select id, created_at, as_of, status, model, read
from public.market_reads
order by created_at desc
limit 1;

revoke all on public.market_read_latest from public;
grant select on public.market_read_latest to anon, authenticated;

comment on view public.market_read_latest is
  'Latest Jev read for the Sign-in preview. Payload fields only; no answers or usage.';
