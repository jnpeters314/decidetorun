#!/usr/bin/env node
/**
 * FEC candidate importer — runs directly in GitHub Actions (no edge function).
 * Fetches all 2026 House and Senate candidates from the FEC API and upserts to Supabase.
 *
 * Required env vars:
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FEC_API_KEY
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pmiqbxxvoabowwiedrej.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FEC_API_KEY = process.env.FEC_API_KEY || 'DEMO_KEY';
const FEC_BASE = 'https://api.open.fec.gov/v1';

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  let totalImported = 0;

  for (const office of ['H', 'S']) {
    console.log(`\nImporting ${office === 'H' ? 'House' : 'Senate'} candidates...`);
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url =
        `${FEC_BASE}/candidates/?election_year=2026&office=${office}` +
        `&per_page=100&page=${page}&api_key=${FEC_API_KEY}&is_active_candidate=true`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error(`FEC API error on page ${page}: ${res.status}`);
        process.exit(1);
      }

      const json = await res.json();
      totalPages = json.pagination?.pages ?? 1;

      const raw = (json.results ?? []).map(mapFecCandidate).filter(Boolean);

      const seen = new Map();
      for (const c of raw) {
        const key = `${c.state}|${c.office_title}|${c.district ?? ''}|${c.candidate_name}`;
        seen.set(key, c);
      }
      const batch = Array.from(seen.values());

      if (batch.length > 0) {
        const { error } = await supabase.from('sos_candidates').upsert(batch, {
          onConflict: 'state,election_year,office_title,district,candidate_name',
        });
        if (error) {
          console.error(`Upsert error on page ${page}:`, error.message);
          process.exit(1);
        }
        totalImported += batch.length;
      }

      process.stdout.write(`\r  Page ${page}/${totalPages} — ${totalImported} total`);
      page++;
    }
    console.log();
  }

  console.log(`\nDone — ${totalImported} candidates upserted.`);
}

function mapFecCandidate(c) {
  const office = c.office ?? '';
  const state = c.state ?? '';
  if (!state || !office) return null;

  const districtRaw = office === 'H' ? String(c.district ?? '0').padStart(2, '0') : null;
  const districtNum = districtRaw ? parseInt(districtRaw, 10) : null;
  const officeTitle =
    office === 'S'
      ? 'U.S. Senate'
      : `U.S. House - District ${districtNum === 0 ? 'At-Large' : districtNum}`;

  return {
    state,
    election_year: 2026,
    office_title: officeTitle,
    district: districtRaw,
    level: 'federal',
    candidate_name: formatFecName(c.name ?? ''),
    party: normalizeParty(c.party ?? ''),
    status: 'filed',
    filing_date: null,
    source: 'fec',
    source_id: c.candidate_id ?? null,
  };
}

function formatFecName(raw) {
  const comma = raw.indexOf(',');
  if (comma === -1) return titleCase(raw);
  const last = raw.slice(0, comma).trim();
  const rest = raw.slice(comma + 1).trim().split(/\s+/).filter(Boolean);
  return [...rest, last].map(titleCase).join(' ').trim();
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function normalizeParty(raw) {
  const p = raw.toUpperCase();
  if (p === 'DEM' || p === 'D' || p.includes('DEMOCRAT')) return 'Democratic';
  if (p === 'REP' || p === 'R' || p.includes('REPUBLICAN')) return 'Republican';
  if (p === 'IND' || p.includes('INDEPEND')) return 'Independent';
  if (p === 'LIB') return 'Libertarian';
  if (p === 'GRE' || p.includes('GREEN')) return 'Green';
  return raw || null;
}

main().catch((e) => { console.error(e); process.exit(1); });
