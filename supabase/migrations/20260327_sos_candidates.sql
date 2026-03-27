-- SoS candidate filing data imported from state Secretary of State offices
CREATE TABLE IF NOT EXISTS sos_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state CHAR(2) NOT NULL,
  election_year INTEGER NOT NULL DEFAULT 2026,
  office_title TEXT NOT NULL,
  district TEXT,
  level TEXT CHECK (level IN ('federal', 'statewide', 'state', 'local')),
  candidate_name TEXT NOT NULL,
  party TEXT,
  status TEXT DEFAULT 'filed',  -- filed, qualified, withdrew, disqualified
  filing_date DATE,
  source TEXT NOT NULL,         -- 'florida_sos', 'california_sos', etc.
  source_id TEXT,               -- original ID from the data source
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state, election_year, office_title, district, candidate_name)
);

CREATE INDEX IF NOT EXISTS sos_candidates_state_year ON sos_candidates (state, election_year);
CREATE INDEX IF NOT EXISTS sos_candidates_district ON sos_candidates (state, level, district);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sos_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sos_candidates_updated_at
  BEFORE UPDATE ON sos_candidates
  FOR EACH ROW EXECUTE FUNCTION update_sos_candidates_updated_at();
