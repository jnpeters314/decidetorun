/**
 * Texas SoS candidate importer
 *
 * Data source: Texas Secretary of State — candidate filing CSV
 * Primary URL: https://www.sos.state.tx.us/elections/candidates/2026/general-candidate-list.csv
 * Fallback:    https://www.sos.state.tx.us/elections/candidates/guide/2026/
 *
 * Hint: Check https://www.sos.state.tx.us/elections/candidates/ for current download links
 * and update TX_URLS below if the paths change each election cycle.
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/import-texas
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

// TX SoS public candidate list — update year/path each election cycle
// Check https://www.sos.state.tx.us/elections/candidates/ for current URL
const TX_URLS = [
  "https://www.sos.state.tx.us/elections/candidates/2026/general-candidate-list.csv",
  "https://www.sos.state.tx.us/elections/candidates/guide/2026/",
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

    for (const url of TX_URLS) {
      triedUrls.push(url);
      const res = await fetch(url);
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      // Only accept CSV-like content; skip HTML error pages
      if (contentType.includes("text/html") && !contentType.includes("csv")) continue;
      text = await res.text();
      successUrl = url;
      break;
    }

    if (!text) {
      return new Response(
        JSON.stringify({
          message: "TX candidate data not available — check URL",
          urls_tried: triedUrls,
          hint: "Check https://www.sos.state.tx.us/elections/candidates/ for the current download link and update TX_URLS in the function",
          count: 0,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const raw = parseTxCsv(text);

    // Deduplicate by unique constraint key
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
      JSON.stringify({ message: "Texas import complete", count: candidates.length, url: successUrl }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

function parseTxCsv(raw: string) {
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
      const cols = splitCsvLine(line);

      // Try multiple possible column name variations
      const candidateName =
        get(cols, "candidate_name") ||
        get(cols, "candidate_name") ||
        get(cols, "name") ||
        "";

      const office =
        get(cols, "office") ||
        get(cols, "office_sought") ||
        "";

      const district =
        get(cols, "district") ||
        get(cols, "district_number") ||
        null;

      const party =
        get(cols, "party") ||
        get(cols, "party_affiliation") ||
        "";

      const rawStatus =
        get(cols, "status") ||
        "filed";

      const filingDate =
        get(cols, "filing_date") ||
        get(cols, "qualifying_date") ||
        null;

      if (!candidateName || !office) return null;

      return {
        state: "TX",
        election_year: 2026,
        office_title: office,
        district: district || null,
        level: inferLevel(office),
        candidate_name: candidateName,
        party: normalizeParty(party),
        status: rawStatus.toLowerCase() || "filed",
        filing_date: parseDate(filingDate ?? ""),
        source: "texas_sos",
        source_id: null,
      };
    })
    .filter(Boolean);
}

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

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (o.includes("u.s. rep") || o.includes("u.s. sen") || o.includes("congress")) return "federal";
  if (
    o.includes("governor") ||
    o.includes("lieutenant governor") ||
    o.includes("attorney general") ||
    o.includes("secretary of state") ||
    o.includes("comptroller") ||
    o.includes("land commissioner") ||
    o.includes("agriculture commissioner") ||
    o.includes("railroad commissioner")
  )
    return "statewide";
  if (
    o.includes("state rep") ||
    o.includes("state sen") ||
    o.includes("texas house") ||
    o.includes("texas senate")
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
  if (p === "IND" || p.includes("INDEPEND")) return "Independent";
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
