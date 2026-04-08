/**
 * get-uncontested-state-races
 *
 * Accepts: POST { state: "NC" }  (2-letter uppercase state code)
 *
 * 1. Fetches ALL current state legislators from OpenStates v3 API (paginated)
 * 2. Queries sos_candidates for 2026 state-level filed candidates
 * 3. Returns state legislative districts that have NO filed candidates
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/get-uncontested-state-races \
 *     -H "Content-Type: application/json" \
 *     -d '{"state":"NC"}'
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENSTATES_API_KEY = Deno.env.get("OPENSTATES_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// OCD jurisdiction name uses underscores for multi-word state names
const STATE_OCD_NAMES: Record<string, string> = {
  AL: "alabama",
  AK: "alaska",
  AZ: "arizona",
  AR: "arkansas",
  CA: "california",
  CO: "colorado",
  CT: "connecticut",
  DE: "delaware",
  FL: "florida",
  GA: "georgia",
  HI: "hawaii",
  ID: "idaho",
  IL: "illinois",
  IN: "indiana",
  IA: "iowa",
  KS: "kansas",
  KY: "kentucky",
  LA: "louisiana",
  ME: "maine",
  MD: "maryland",
  MA: "massachusetts",
  MI: "michigan",
  MN: "minnesota",
  MS: "mississippi",
  MO: "missouri",
  MT: "montana",
  NE: "nebraska",
  NV: "nevada",
  NH: "new_hampshire",
  NJ: "new_jersey",
  NM: "new_mexico",
  NY: "new_york",
  NC: "north_carolina",
  ND: "north_dakota",
  OH: "ohio",
  OK: "oklahoma",
  OR: "oregon",
  PA: "pennsylvania",
  RI: "rhode_island",
  SC: "south_carolina",
  SD: "south_dakota",
  TN: "tennessee",
  TX: "texas",
  UT: "utah",
  VT: "vermont",
  VA: "virginia",
  WA: "washington",
  WV: "west_virginia",
  WI: "wisconsin",
  WY: "wyoming",
};

const STATE_FULL_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

interface Legislator {
  name: string;
  party: string;
  current_role: {
    title: string;
    org_classification: "upper" | "lower";
    district: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const state: string = (body.state ?? "").toString().toUpperCase().trim();

    if (!state || state.length !== 2 || !STATE_OCD_NAMES[state]) {
      return new Response(
        JSON.stringify({
          error: "Invalid state code",
          hint: "Provide a 2-letter uppercase US state code, e.g. { state: 'NC' }",
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const ocdName = STATE_OCD_NAMES[state];
    const jurisdictionId = `ocd-jurisdiction/country:us/state:${ocdName}/government`;

    // ----------------------------------------------------------------
    // 1. Fetch all current legislators from OpenStates (paginated)
    // ----------------------------------------------------------------
    const legislators: Legislator[] = [];
    let page = 1;

    while (true) {
      const url =
        `https://v3.openstates.org/people` +
        `?jurisdiction=${encodeURIComponent(jurisdictionId)}` +
        `&current_role=true` +
        `&per_page=200` +
        `&page=${page}`;

      const res = await fetch(url, {
        headers: { "X-API-KEY": OPENSTATES_API_KEY },
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: `OpenStates API error: ${res.status}`,
            hint: `Check that OPENSTATES_API_KEY is set and the state code '${state}' is valid`,
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      const data = await res.json();
      const results: Legislator[] = data.results ?? [];

      for (const leg of results) {
        // Only include state legislators (upper/lower chamber), skip other roles
        if (
          leg.current_role &&
          (leg.current_role.org_classification === "upper" ||
            leg.current_role.org_classification === "lower")
        ) {
          legislators.push(leg);
        }
      }

      if (results.length < 200) break;
      page++;
    }

    if (legislators.length === 0) {
      return new Response(
        JSON.stringify({
          error: `No legislators found for state: ${state}`,
          hint: "OpenStates may not have data for this state, or the jurisdiction ID may be wrong",
          jurisdiction_id: jurisdictionId,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // ----------------------------------------------------------------
    // 2. Query sos_candidates for 2026 state-level filed candidates
    // ----------------------------------------------------------------
    const { data: filed, error: dbError } = await supabase
      .from("sos_candidates")
      .select("district, office_title")
      .eq("state", state)
      .eq("election_year", 2026)
      .eq("level", "state");

    if (dbError) throw dbError;

    const hasStateData = Array.isArray(filed) && filed.length > 0;

    // Build a set of "org_classification|district" keys that have filed candidates
    const districtsFiled = new Set<string>();
    if (hasStateData && filed) {
      for (const row of filed) {
        const dist = String(row.district ?? "").trim();
        const title = (row.office_title ?? "").toLowerCase();
        // Infer chamber from office title
        const isSenate =
          title.includes("senate") ||
          title.includes("senator") ||
          title.includes("upper");
        const classification = isSenate ? "upper" : "lower";
        if (dist) {
          districtsFiled.add(`${classification}|${dist}`);
        }
      }
    }

    // ----------------------------------------------------------------
    // 3. Build response — uncontested districts
    // ----------------------------------------------------------------
    const races = [];

    for (const leg of legislators) {
      const { org_classification, district } = leg.current_role;
      const isSenate = org_classification === "upper";
      const distKey = `${org_classification}|${district}`;

      // If we have verified data, only include districts NOT in districtsFiled
      if (hasStateData && districtsFiled.has(distKey)) continue;

      const partyMap: Record<string, string> = {
        Democratic: "D",
        Republican: "R",
        Independent: "I",
        Libertarian: "L",
        Green: "G",
      };
      const partyInitial = partyMap[leg.party] ?? leg.party?.charAt(0) ?? "?";

      const stateFull = STATE_FULL_NAMES[state] ?? state;
      const chamberLabel = isSenate ? "State Senate" : "State House";

      races.push({
        id: `openstates-${org_classification}-${state}-${district}`.toLowerCase(),
        title: `${stateFull} ${chamberLabel} \u2014 District ${district}`,
        level: "state",
        state,
        district: String(district),
        office_type: isSenate ? "state_senate" : "state_house",
        office_type_label: chamberLabel,
        incumbent: `${leg.name} (${partyInitial})`,
        total_candidates: 0,
        candidates_running: [],
        confidence: hasStateData ? "medium" : "low",
        data_source: "OpenStates",
        verified_uncontested: hasStateData,
      });
    }

    return new Response(
      JSON.stringify({
        races,
        has_verified_data: hasStateData,
        state,
        total_districts_found: legislators.length,
        source: "openstates",
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
