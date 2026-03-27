/**
 * California SoS candidate importer
 *
 * Data source: California Civic Data Coalition — processed CAL-ACCESS data
 * Portal:  https://calaccess.californiacivicdata.org/downloads/latest/
 * Files:   candidatecontests.csv  — races (office + district + election)
 *          candidates.csv         — candidate name, party, contest link
 *
 * CAL-ACCESS is California's official campaign finance and candidate system.
 * The Civic Data Coalition cleans and publishes it in usable CSV form.
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/import-california \
 *     -H "Authorization: Bearer <service_role_key>"
 *
 * Schedule with pg_cron (weekly refresh):
 *   SELECT cron.schedule('import-ca-candidates', '0 7 * * 1',
 *     $$SELECT net.http_post(url := '...', headers := '{"Authorization":"Bearer ..."}')$$);
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CALACCESS_BASE = "https://calaccess.californiacivicdata.org/downloads/latest";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Fetch both files in parallel
    const [contestsRes, candidatesRes] = await Promise.all([
      fetch(`${CALACCESS_BASE}/candidatecontests.csv`),
      fetch(`${CALACCESS_BASE}/candidates.csv`),
    ]);

    if (!contestsRes.ok) throw new Error(`CAL-ACCESS contests fetch failed: ${contestsRes.status}`);
    if (!candidatesRes.ok) throw new Error(`CAL-ACCESS candidates fetch failed: ${candidatesRes.status}`);

    const [contestsCsv, candidatesCsv] = await Promise.all([
      contestsRes.text(),
      candidatesRes.text(),
    ]);

    const contests = parseCsv(contestsCsv);   // { id, name, election_type, office, district, ... }
    const candidates = parseCsv(candidatesCsv); // { contest_id, name, party, ... }

    // Build a contest lookup map
    const contestMap = new Map(contests.map((c) => [c.id, c]));

    // Only keep 2026 general election candidates
    const records = candidates
      .map((cand) => {
        const contest = contestMap.get(cand.contest_id ?? cand.candidatecontest_id);
        if (!contest) return null;

        // Filter to 2026 elections only
        const electionName = (contest.election ?? contest.name ?? "").toLowerCase();
        if (!electionName.includes("2026")) return null;

        const office = contest.office ?? contest.name ?? "";
        const district = contest.district ?? contest.district_code ?? null;

        return {
          state: "CA",
          election_year: 2026,
          office_title: normalizeOfficeName(office),
          district: district ? String(district) : null,
          level: inferLevel(office),
          candidate_name: cand.name ?? cand.candidate_name ?? "",
          party: normalizeParty(cand.party ?? cand.party_code ?? ""),
          status: (cand.status ?? "filed").toLowerCase(),
          filing_date: parseDate(cand.filing_date ?? cand.created_at),
          source: "california_sos",
          source_id: cand.id ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.candidate_name !== "");

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ message: "No 2026 CA candidates found — check data source", count: 0 }),
        { headers: CORS_HEADERS }
      );
    }

    const { error } = await supabase.from("sos_candidates").upsert(records, {
      onConflict: "state,election_year,office_title,district,candidate_name",
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "California import complete", count: records.length }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

// Minimal CSV parser — handles quoted fields
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function normalizeOfficeName(office: string): string {
  return office
    .replace(/\bST\b/gi, "State")
    .replace(/\bASM\b/gi, "Assembly")
    .replace(/\bSEN\b/gi, "Senate")
    .trim();
}

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (o.includes("u.s. rep") || o.includes("congress") || o.includes("u.s. sen")) return "federal";
  if (
    o.includes("governor") ||
    o.includes("attorney general") ||
    o.includes("secretary of state") ||
    o.includes("treasurer") ||
    o.includes("controller") ||
    o.includes("insurance commissioner") ||
    o.includes("superintendent")
  )
    return "statewide";
  if (o.includes("assembly") || o.includes("state senate")) return "state";
  return "local";
}

function normalizeParty(raw: string): string | null {
  const p = raw.toUpperCase();
  if (p === "DEM" || p.includes("DEMOCRAT")) return "Democratic";
  if (p === "REP" || p.includes("REPUBLICAN")) return "Republican";
  if (p === "GRN" || p.includes("GREEN")) return "Green";
  if (p === "LIB" || p.includes("LIBERTARIAN")) return "Libertarian";
  if (p === "NPP" || p.includes("NO PARTY") || p.includes("DECLINE")) return "No Party Preference";
  return raw || null;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  try {
    return new Date(raw).toISOString().split("T")[0];
  } catch {
    return null;
  }
}
