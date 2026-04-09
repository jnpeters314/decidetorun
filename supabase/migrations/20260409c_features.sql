-- ── 1. Eleanor rate-limiting ──────────────────────────────────────────────────
-- Tracks calls to eleanor-chat per IP so we can enforce 10/hr
create table if not exists eleanor_requests (
  id           uuid primary key default gen_random_uuid(),
  ip           text not null,
  requested_at timestamptz not null default now()
);
create index if not exists eleanor_requests_ip_time
  on eleanor_requests (ip, requested_at);

-- Service role can insert; no reads needed via RLS
alter table eleanor_requests enable row level security;
create policy "Service role manages eleanor_requests"
  on eleanor_requests for all
  using (auth.role() = 'service_role');

-- ── 2. submitted_races: add reported_count + flagged status ───────────────────
alter table submitted_races
  add column if not exists reported_count integer not null default 0;

-- Extend the status check constraint to include 'flagged'
-- (drop + re-add since ALTER TABLE ... ALTER CONSTRAINT isn't supported in PG 14-)
alter table submitted_races drop constraint if exists submitted_races_status_check;
alter table submitted_races
  add constraint submitted_races_status_check
  check (status in ('pending', 'published', 'removed', 'flagged'));

-- Index for admin view (fetch pending + flagged quickly)
create index if not exists submitted_races_admin
  on submitted_races (status, submitted_at desc)
  where status in ('pending', 'flagged');

-- ── 3. Race alert subscriptions ───────────────────────────────────────────────
create table if not exists race_alerts (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  state      char(2),           -- null means "all states"
  level      text,              -- null means all levels
  created_at timestamptz not null default now()
);
create index if not exists race_alerts_email on race_alerts (email);
create index if not exists race_alerts_state  on race_alerts (state);

alter table race_alerts enable row level security;
create policy "Service role manages race_alerts"
  on race_alerts for all
  using (auth.role() = 'service_role');

-- ── 4. Data freshness view ────────────────────────────────────────────────────
-- Expose max(updated_at) per state so the UI can show "data as of …"
create or replace view sos_data_freshness as
  select state, max(updated_at) as last_updated
  from sos_candidates
  group by state;
