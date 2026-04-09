/**
 * submit-race
 *
 * Accepts community-submitted race/office info and inserts into submitted_races table.
 * Submissions are immediately published with status='published' and confidence='community'.
 * They appear in the uncontested view with a "Community Submitted" badge.
 *
 * POST body:
 *   {
 *     office_title: string,       // required
 *     level: string,              // required: federal|statewide|state|local
 *     state: string,              // required: 2-letter code
 *     district: string?,          // optional
 *     city: string?,              // optional
 *     filing_deadline: string?,   // optional: ISO date YYYY-MM-DD
 *     next_election: string?,     // optional: ISO date YYYY-MM-DD
 *     source_url: string?,        // optional: where submitter found this
 *     notes: string?,             // optional
 *     submitter_email: string?,   // optional
 *   }
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

const VALID_LEVELS = ["federal", "statewide", "state", "local"];
const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: CORS_HEADERS,
    });
  }

  try {
    const body = await req.json();
    const {
      office_title,
      level,
      state,
      district,
      city,
      filing_deadline,
      next_election,
      source_url,
      notes,
      submitter_email,
    } = body;

    // Validate required fields
    if (!office_title?.trim()) {
      return new Response(JSON.stringify({ error: "office_title is required" }), {
        status: 400, headers: CORS_HEADERS,
      });
    }
    if (!VALID_LEVELS.includes(level)) {
      return new Response(JSON.stringify({ error: "level must be federal, statewide, state, or local" }), {
        status: 400, headers: CORS_HEADERS,
      });
    }
    if (!state || !VALID_STATES.has(state.toUpperCase())) {
      return new Response(JSON.stringify({ error: "A valid 2-letter US state code is required" }), {
        status: 400, headers: CORS_HEADERS,
      });
    }

    // Sanitize text fields — strip HTML tags
    const sanitize = (s: string | undefined) =>
      s ? s.replace(/<[^>]*>/g, "").trim().slice(0, 500) : null;

    const record = {
      office_title: sanitize(office_title)!,
      level,
      state: state.toUpperCase(),
      district: sanitize(district),
      city: sanitize(city),
      filing_deadline: filing_deadline || null,
      next_election: next_election || null,
      source_url: source_url?.trim().slice(0, 500) || null,
      notes: sanitize(notes),
      submitter_email: submitter_email?.trim().slice(0, 200) || null,
      status: "published",
      confidence: "community",
      total_candidates: 0,
      data_source: "community",
      submitted_at: new Date().toISOString(),
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from("submitted_races")
      .insert(record)
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Race submitted successfully", id: data.id }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
