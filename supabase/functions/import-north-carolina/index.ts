/**
 * North Carolina NCSBE candidate importer
 *
 * Data source: NC State Board of Elections — S3 public data portal
 * URL:     https://s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/Candidate_Listing_2026.csv
 * Format:  CSV (comma-separated)
 * Updates: During qualifying/filing periods (primary filing closed March 2026)
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/import-north-carolina
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

// NCSBE S3 public bucket — update year/path each cycle
// Check https://www.ncsbe.gov/results-data/candidate-lists for current URL
const NC_URLS = [
  "https://s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/Candidate_Listing_2026.csv",
  "https://dl.ncsbe.gov/Elections/2026/Candidate%20Filing/Candidate_Listing_2026.csv",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let text: string | null = null;
    let successUrl = "";
    const triedUrls: string[] = [];

    for (const url of NC_URLS) {
      triedUrls.push(url);
      const res = await fetch(url);
      if (!res.ok) continue;
      text = await res.text();
      successUrl = url;
      break;
    }

    if (!text) {
      return new Response(
        JSON.stringify({
          message: "NC candidate data not available — check URL",
          urls_tried: triedUrls,
          hint: "Check https://www.ncsbe.gov/results-data/candidate-lists for the current download link and update NC_URLS in the function",
          count: 0,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const raw = parseNcCsv(text);

    // Deduplicate by unique constraint key — CSV sometimes lists same candidate twice
    const seen = new Map<string, typeof raw[0]>();
    for (const c of raw) {
      if (!c) continue;
      const key = `${c.office_title}|${c.district ?? ""}|${c.candidate_name}`;
      seen.set(key, c);
    }
    const candidates = Array.from(seen.values());

    if (candidates.length === 0) {
      const firstLine = text.split("\n")[0];
      return new Response(
        JSON.stringify({
          message: "File fetched but no candidates parsed — check field names",
          url: successUrl,
          first_line: firstLine,
          count: 0,
        }),
        { headers: CORS_HEADERS }
      );
    }

    const { error } = await supabase.from("sos_candidates").upsert(candidates, {
      onConflict: "state,election_year,office_title,district,candidate_name",
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "North Carolina import complete", count: candidates.length, url: successUrl }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

function parseNcCsv(raw: string) {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));

  const get = (cols: string[], key: string) =>
    cols[headers.indexOf(key)]?.trim().replace(/^"|"$/g, "") ?? "";

  return lines
    .slice(1)
    .map((line) => {
      // Handle quoted CSV fields
      const cols = splitCsvLine(line);

      const firstName = get(cols, "first_name");
      const lastName = get(cols, "last_name");
      const nameOnBallot = get(cols, "name_on_ballot");
      const fullName = nameOnBallot || (firstName && lastName ? `${firstName} ${lastName}` : "");

      const office = get(cols, "contest_name");
      const district = extractDistrict(office);
      const party =
        get(cols, "party_candidate") || get(cols, "party_contest") || get(cols, "party");
      const fileDate = get(cols, "candidacy_dt") || get(cols, "filing_date") || null;

      if (!fullName || !office) return null;

      return {
        state: "NC",
        election_year: 2026,
        office_title: office,
        district: district || null,
        level: inferLevel(office),
        candidate_name: fullName,
        party: normalizeParty(party),
        status: "filed",
        filing_date: parseDate(fileDate ?? ""),
        source: "north_carolina_sbe",
        source_id: null,
      };
    })
    .filter(Boolean);
}

// Simple CSV line splitter that handles quoted fields
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function extractDistrict(office: string): string | null {
  const m = office.match(/district\s+(\d+)/i) || office.match(/(\d+)(?:st|nd|rd|th)\s+district/i);
  return m ? m[1] : null;
}

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (o.includes("u.s. rep") || o.includes("u.s. sen") || o.includes("congress")) return "federal";
  if (
    o.includes("governor") ||
    o.includes("attorney general") ||
    o.includes("secretary of state") ||
    o.includes("treasurer") ||
    o.includes("auditor") ||
    o.includes("commissioner of") ||
    o.includes("superintendent")
  )
    return "statewide";
  if (
    o.includes("n.c. house") ||
    o.includes("n.c. senate") ||
    o.includes("state house") ||
    o.includes("state senate")
  )
    return "state";
  return "local";
}

function normalizeParty(raw: string): string | null {
  const p = raw.toUpperCase();
  if (p === "DEM" || p === "D" || p.includes("DEMOCRAT")) return "Democratic";
  if (p === "REP" || p === "R" || p.includes("REPUBLICAN")) return "Republican";
  if (p === "LIB") return "Libertarian";
  if (p === "GRE" || p.includes("GREEN")) return "Green";
  if (p === "UNA" || p.includes("UNAFFILIAT") || p.includes("INDEPEND")) return "Unaffiliated";
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
