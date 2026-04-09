-- Community-submitted races table
-- Stores races submitted by users that aren't yet in our official data sources.
-- status: 'published' = visible on site with "Community Submitted" badge
--         'pending'   = awaiting review (reserved for future moderation flow)
--         'removed'   = soft-deleted

create table if not exists submitted_races (
  id                uuid primary key default gen_random_uuid(),
  office_title      text not null,
  level             text not null check (level in ('federal', 'statewide', 'state', 'local')),
  state             char(2) not null,
  district          text,
  city              text,
  filing_deadline   date,
  next_election     date,
  source_url        text,
  notes             text,
  submitter_email   text,
  status            text not null default 'published' check (status in ('pending', 'published', 'removed')),
  confidence        text not null default 'community',
  total_candidates  integer not null default 0,
  data_source       text not null default 'community',
  submitted_at      timestamptz not null default now()
);

-- Index for the uncontested view query (filter by status + level + state)
create index if not exists submitted_races_status_state
  on submitted_races (status, state);

-- Allow the edge function (service role) to insert
-- Allow anon/authenticated to read published rows
alter table submitted_races enable row level security;

create policy "Anyone can read published submissions"
  on submitted_races for select
  using (status = 'published');

create policy "Service role can do everything"
  on submitted_races for all
  using (auth.role() = 'service_role');
