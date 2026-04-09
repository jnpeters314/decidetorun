-- Add bot-protection and AI review columns to submitted_races
alter table submitted_races
  add column if not exists submitter_ip text,
  add column if not exists review_note  text;

-- Index for IP rate-limiting queries
create index if not exists submitted_races_ip_time
  on submitted_races (submitter_ip, submitted_at);
