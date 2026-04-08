/**
 * Colorado SoS candidate importer
 *
 * Data source: Colorado Secretary of State — candidate filing data
 * Primary (Socrata): https://data.colorado.gov — search for "candidate" or "campaign finance"
 *   NOTE: "abcd-5678" below is a PLACEHOLDER. Find the real dataset ID at https://data.colorado.gov
 *   and search for "candidate" or "campaign finance". Replace "abcd-5678" with the actual ID.
 * Fallback CSV: https://www.sos.state.co.us/pubs/elections/resultsData/2026/candidateList.csv
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/import-colorado
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

// NOTE: "abcd-5678" is a placeholder dataset ID.
// Find the real one at https://data.colorado.gov — search for "candidate" or "campaign finance".
const CO_SOCRATA_URL =
  "https://data.colorado.gov/resource/abcd-5678.json?$where=election_year='2026'&$limit=5000";

// Fallback CSV from CO SoS
const CO_CSV_URL =
  "https://www.sos.state.co.us/pubs/elections/resultsData/2026/candidateList.csv";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let candidates: ReturnType<typeof mapSocrataRecord>[] = [];
    let successUrl = "";
    let usedSource = "";

    // Try Socrata JSON first
    const socrataRes = await fetch(CO_SOCRATA_URL, {
      headers: { Accept: "application/json" },
    });

    if (socrataRes.ok) {
      const contentType = socrataRes.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const records = await socrataRes.json();
        if (Array.isArray(records) && records.length > 0) {
          const firstKeys = Object.keys(records[0]);
          const mapped = records.map(mapSocrataRecord).filter(Boolean);
          if (mapped.length > 0) {
            candidates = mapped;
            successUrl = CO_SOCRATA_URL;
            usedSource = "socrata";
          } else {
            return new Response(
              JSON.stringify({
                message: "Socrata records fetched but none mapped — check field names or dataset ID",
                raw_count: records.length,
                first_record_keys: firstKeys,
                first_record: records[0],
                hint: "Update CO_SOCRATA_URL with the real dataset ID from https://data.colorado.gov",
              }),
              { headers: CORS_HEADERS }
            );
          }
        }
      }
    }

    // Fall back to CSV if Socrata failed or returned nothing
    if (candidates.length === 0) {
      const csvRes = await fetch(CO_CSV_URL);
      if (!csvRes.ok) {
        return new Response(
          JSON.stringify({
            message: "CO candidate data not available — check URLs",
            urls_tried: [CO_SOCRATA_URL, CO_CSV_URL],
            hint: "Update CO_SOCRATA_URL with the real dataset ID from https://data.colorado.gov",
            count: 0,
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }
      const text = await csvRes.text();
      const raw = parseCoCsv(text);
      candidates = raw.filter(Boolean) as typeof candidates;
      successUrl = CO_CSV_URL;
      usedSource = "csv";
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          message: "File fetched but no candidates parsed — check field names",
          url: successUrl,
          count: 0,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // Deduplicate by unique constraint key
    const seen = new Map<string, typeof candidates[0]>();
    for (const c of candidates) {
      if (!c) continue;
      const key = `${c.office_title}|${c.district ?? ""}|${c.candidate_name}`;
      seen.set(key, c);
    }
    const deduped = Array.from(seen.values());

    const { error } = await supabase.from("sos_candidates").upsert(deduped, {
      onConflict: "state,election_year,office_title,district,candidate_name",
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({
        message: "Colorado import complete",
        count: deduped.length,
        url: successUrl,
        source_format: usedSource,
      }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

function mapSocrataRecord(r: Record<string, unknown>) {
  const name =
    ((r.candidate_name || r.name || r.filer_name) as string | undefined)?.trim() ?? "";
  const office =
    ((r.office || r.office_name || r.position) as string | undefined)?.trim() ?? "";
  const district =
    ((r.district || r.legislative_district) as string | undefined | null) ?? null;
  const party =
    ((r.party || r.party_affiliation) as string | undefined) ?? "";
  const filingDate =
    ((r.filing_date || r.registration_date) as string | undefined) ?? null;

  if (!name || !office) return null;

  return {
    state: "CO",
    election_year: 2026,
    office_title: office,
    district: district || null,
    level: inferLevel(office),
    candidate_name: name,
    party: normalizeParty(party),
    status: "filed",
    filing_date: parseDate(filingDate ?? ""),
    source: "colorado_sos",
    source_id: ((r.id || r.filer_id || r.candidate_id) as string | undefined) ?? null,
  };
}

function parseCoCsv(raw: string) {
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

      const candidateName =
        get(cols, "candidate_name") ||
        get(cols, "name") ||
        get(cols, "filer_name") ||
        "";

      const office =
        get(cols, "office") ||
        get(cols, "office_name") ||
        get(cols, "position") ||
        "";

      const district =
        get(cols, "district") ||
        get(cols, "legislative_district") ||
        null;

      const party =
        get(cols, "party") ||
        get(cols, "party_affiliation") ||
        "";

      const filingDate =
        get(cols, "filing_date") ||
        get(cols, "registration_date") ||
        null;

      if (!candidateName || !office) return null;

      return {
        state: "CO",
        election_year: 2026,
        office_title: office,
        district: district || null,
        level: inferLevel(office),
        candidate_name: candidateName,
        party: normalizeParty(party),
        status: "filed",
        filing_date: parseDate(filingDate ?? ""),
        source: "colorado_sos",
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
    o.includes("lt. governor") ||
    o.includes("attorney general") ||
    o.includes("secretary of state") ||
    o.includes("treasurer") ||
    o.includes("state controller")
  )
    return "statewide";
  if (
    o.includes("state representative") ||
    o.includes("state senator") ||
    o.includes("house district") ||
    o.includes("senate district")
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
