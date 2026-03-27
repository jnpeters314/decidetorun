/**
 * Washington State PDC candidate importer
 *
 * Data source: Washington Public Disclosure Commission via data.wa.gov Socrata API
 * Dataset:  https://data.wa.gov/Politics/Candidate-and-Committee-Registrations/iz23-7xxj
 * Format:   JSON (Socrata REST API, CORS-friendly, no auth required)
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/import-washington
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Free app token from https://dev.socrata.com/docs/app-tokens.html
// Set via: npx supabase secrets set WA_SOCRATA_APP_TOKEN=your_token
const WA_APP_TOKEN = Deno.env.get("WA_SOCRATA_APP_TOKEN") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Washington PDC Candidate and Committee Registrations (Socrata)
const WA_URL = "https://data.wa.gov/resource/iz23-7xxj.json";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Socrata supports SoQL filtering; limit 5000 should cover all WA 2026 candidates
    const url = `${WA_URL}?$where=election_year=2026&$limit=5000`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (WA_APP_TOKEN) headers["X-App-Token"] = WA_APP_TOKEN;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: `WA fetch failed: ${res.status}`,
          url_tried: url,
          hint: "Check https://data.wa.gov/resource/iz23-7xxj.json for current field names",
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const records = await res.json();

    if (!Array.isArray(records) || records.length === 0) {
      // Return a sample of raw keys so we can see actual field names if data isn't there
      const sampleKeys = Array.isArray(records) ? [] : Object.keys(records ?? {});
      return new Response(
        JSON.stringify({
          message: "No WA 2026 candidates found — filing may not have opened yet",
          count: 0,
          sample_keys: sampleKeys,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // Log first record's keys to help debug field names if mapping is wrong
    const firstKeys = Object.keys(records[0]);

    const candidates = records.map(mapWaRecord).filter(Boolean);

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Records fetched but none mapped — check field names",
          raw_count: records.length,
          first_record_keys: firstKeys,
          first_record: records[0],
        }),
        { headers: CORS_HEADERS }
      );
    }

    const { error } = await supabase.from("sos_candidates").upsert(candidates, {
      onConflict: "state,election_year,office_title,district,candidate_name",
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Washington import complete", count: candidates.length }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

function mapWaRecord(r: Record<string, unknown>) {
  // PDC dataset — try multiple possible field name variations
  const name =
    ((r.candidate_name || r.filer_name || r.name) as string | undefined)?.trim() ?? "";
  const office =
    ((r.office || r.office_sought || r.position || r.race) as string | undefined)?.trim() ?? "";
  const district =
    ((r.legislative_district || r.district || r.district_name || r.jurisdiction) as
      | string
      | undefined
      | null) ?? null;
  const party = ((r.party || r.party_code) as string | undefined) ?? "";

  if (!name || !office) return null;

  // Skip committee registrations — only want individual candidates
  const type = ((r.filer_type || r.type) as string | undefined)?.toLowerCase() ?? "";
  if (type.includes("committee") || type.includes("pac")) return null;

  return {
    state: "WA",
    election_year: 2026,
    office_title: office,
    district: district || null,
    level: inferLevel(office),
    candidate_name: name,
    party: normalizeParty(party),
    status: "filed",
    filing_date: null,
    source: "washington_sos",
    source_id: ((r.filer_id || r.id) as string | undefined) ?? null,
  };
}

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (
    o.includes("u.s. rep") ||
    o.includes("u.s. sen") ||
    o.includes("congress") ||
    o.includes("representative in congress")
  )
    return "federal";
  if (
    o.includes("governor") ||
    o.includes("lieutenant governor") ||
    o.includes("attorney general") ||
    o.includes("secretary of state") ||
    o.includes("state treasurer") ||
    o.includes("state auditor") ||
    o.includes("commissioner of public lands") ||
    o.includes("superintendent of public instruction") ||
    o.includes("insurance commissioner")
  )
    return "statewide";
  if (
    o.includes("state representative") ||
    o.includes("state senator") ||
    o.includes("state senate")
  )
    return "state";
  return "local";
}

function normalizeParty(raw: string): string | null {
  const p = raw.toUpperCase();
  if (p === "DEM" || p === "D" || p.includes("DEMOCRAT")) return "Democratic";
  if (p === "REP" || p === "R" || p.includes("REPUBLICAN")) return "Republican";
  if (p === "IND" || p.includes("INDEPEND")) return "Independent";
  if (p === "LIB") return "Libertarian";
  if (p === "GRE" || p.includes("GREEN")) return "Green";
  return raw || null;
}
