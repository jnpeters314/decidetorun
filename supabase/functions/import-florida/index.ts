/**
 * Florida SoS candidate importer
 *
 * Data source: Florida Division of Elections — qualifying data
 * Portal:  https://dos.fl.gov/elections/candidates/
 * Format:  Tab-separated .txt files published during qualifying periods
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/import-florida \
 *     -H "Authorization: Bearer <service_role_key>"
 *
 * Schedule with pg_cron (run once a day during qualifying period):
 *   SELECT cron.schedule('import-fl-candidates', '0 6 * * *',
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

// Florida DOE publishes qualifying data as a tab-delimited .txt file.
// Check https://dos.fl.gov/elections/candidates/ each cycle for the current URL.
// The file is typically named something like "qualifying_2026_general.txt".
const FL_DATA_URL =
  "https://dos.fl.gov/elections/data-statistics/elections-data/candidate-information/";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(FL_DATA_URL);
    if (!res.ok) throw new Error(`FL fetch failed: ${res.status}`);
    const text = await res.text();

    const candidates = parseFloridaTsv(text);
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No candidates parsed — check FL_DATA_URL format", count: 0 }),
        { headers: CORS_HEADERS }
      );
    }

    const { error } = await supabase.from("sos_candidates").upsert(candidates, {
      onConflict: "state,election_year,office_title,district,candidate_name",
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Florida import complete", count: candidates.length }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

// Florida qualifying files are tab-separated with a header row.
// Common columns (verify against current file):
//   CANDIDATE NAME | OFFICE | PARTY | DISTRICT | STATUS | QUALIFYING DATE
function parseFloridaTsv(raw: string) {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split("\t");
      const get = (key: string) => cols[headers.indexOf(key)]?.trim() ?? "";

      const office = get("office") || get("office_sought") || get("race");
      const district = get("district") || get("district_number") || null;
      const candidateName =
        get("candidate_name") || get("name") || get("candidate");

      if (!candidateName || !office) return null;

      return {
        state: "FL",
        election_year: 2026,
        office_title: office,
        district: district || null,
        level: inferLevel(office),
        candidate_name: candidateName,
        party: normalizeParty(get("party") || get("party_affiliation")),
        status: (get("status") || "filed").toLowerCase(),
        filing_date: parseDate(get("qualifying_date") || get("filing_date")),
        source: "florida_sos",
        source_id: get("candidate_id") || get("id") || null,
      };
    })
    .filter(Boolean);
}

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (o.includes("u.s. rep") || o.includes("u.s. sen") || o.includes("congress")) return "federal";
  if (
    o.includes("governor") ||
    o.includes("attorney general") ||
    o.includes("secretary of state") ||
    o.includes("chief financial") ||
    o.includes("commissioner of agriculture")
  )
    return "statewide";
  if (o.includes("state house") || o.includes("state senate")) return "state";
  return "local";
}

function normalizeParty(raw: string): string | null {
  const p = raw.toUpperCase();
  if (p === "DEM" || p === "D" || p.includes("DEMOCRAT")) return "Democratic";
  if (p === "REP" || p === "R" || p.includes("REPUBLICAN")) return "Republican";
  if (p === "NPA" || p.includes("NO PARTY") || p.includes("NONPART")) return "No Party Affiliation";
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
