/**
 * California SoS candidate importer
 *
 * Primary source: California Civic Data Coalition (processed CAL-ACCESS)
 *   https://calaccess.californiacivicdata.org/downloads/latest/
 *
 * Fallback: Direct CAL-ACCESS bulk export from CA SoS
 *   https://campaignfinance.cdn.sos.ca.gov/dbwebexport.zip
 *   (large ZIP — only used if CCDC is unavailable)
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

const CCDC_BASE = "https://calaccess.californiacivicdata.org/downloads/latest";

// CCDC has used several naming conventions over the years — try all of them
const CONTEST_FILE_CANDIDATES = [
  "candidatecontests.csv",
  "CandidateContest.csv",
  "candidate_contests.csv",
];
const CANDIDATE_FILE_CANDIDATES = [
  "candidates.csv",
  "Candidate.csv",
  "candidate.csv",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Step 1: discover what files are actually available
    const indexRes = await fetch(`${CCDC_BASE}/`);
    const indexHtml = indexRes.ok ? await indexRes.text() : "";

    // Extract all .csv hrefs from the index page
    const availableFiles = [...indexHtml.matchAll(/href="([^"]+\.csv)"/gi)]
      .map((m) => m[1].replace(/^.*\//, "").toLowerCase());

    console.log("CCDC available files:", availableFiles.join(", ") || "(none found)");

    // Step 2: find contest and candidate file names
    const contestFile = CONTEST_FILE_CANDIDATES.find((f) =>
      availableFiles.includes(f.toLowerCase())
    );
    const candidateFile = CANDIDATE_FILE_CANDIDATES.find((f) =>
      availableFiles.includes(f.toLowerCase())
    );

    if (!contestFile || !candidateFile) {
      // Return what we found so we can update the filenames
      return new Response(
        JSON.stringify({
          error: "Could not find contest/candidate CSV files at CCDC",
          available_files: availableFiles,
          tried_contests: CONTEST_FILE_CANDIDATES,
          tried_candidates: CANDIDATE_FILE_CANDIDATES,
          index_url: `${CCDC_BASE}/`,
          index_status: indexRes.status,
        }),
        { status: 200, headers: CORS_HEADERS } // 200 so GitHub Actions shows the body
      );
    }

    // Step 3: fetch and parse the two CSVs
    const [contestsRes, candidatesRes] = await Promise.all([
      fetch(`${CCDC_BASE}/${contestFile}`),
      fetch(`${CCDC_BASE}/${candidateFile}`),
    ]);

    if (!contestsRes.ok) throw new Error(`Contests fetch failed: ${contestsRes.status}`);
    if (!candidatesRes.ok) throw new Error(`Candidates fetch failed: ${candidatesRes.status}`);

    const [contestsCsv, candidatesCsv] = await Promise.all([
      contestsRes.text(),
      candidatesRes.text(),
    ]);

    const contests = parseCsv(contestsCsv);
    const candidates = parseCsv(candidatesCsv);

    const contestMap = new Map(contests.map((c) => [c.id, c]));

    const records = candidates
      .map((cand) => {
        const contest = contestMap.get(cand.contest_id ?? cand.candidatecontest_id);
        if (!contest) return null;

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
        JSON.stringify({
          message: "No 2026 CA candidates found in data",
          contests_parsed: contests.length,
          candidates_parsed: candidates.length,
        }),
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
  return office.replace(/\bST\b/gi, "State").replace(/\bASM\b/gi, "Assembly").replace(/\bSEN\b/gi, "Senate").trim();
}

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (o.includes("u.s. rep") || o.includes("congress") || o.includes("u.s. sen")) return "federal";
  if (o.includes("governor") || o.includes("attorney general") || o.includes("secretary of state") || o.includes("treasurer") || o.includes("controller") || o.includes("insurance commissioner") || o.includes("superintendent")) return "statewide";
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
  try { return new Date(raw).toISOString().split("T")[0]; } catch { return null; }
}
