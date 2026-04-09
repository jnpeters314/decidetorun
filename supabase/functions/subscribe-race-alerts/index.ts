/**
 * subscribe-race-alerts
 *
 * Accepts an email + optional state/level filter and stores it in race_alerts.
 * Deduplicates by (email, state, level) — silently succeeds if already subscribed.
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

const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
]);
const VALID_LEVELS = new Set(["federal", "statewide", "state", "local"]);

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
    const { email, state, level } = await req.json();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: CORS_HEADERS,
      });
    }

    const cleanEmail = email.trim().toLowerCase().slice(0, 200);
    const cleanState = state && VALID_STATES.has(state.toUpperCase()) ? state.toUpperCase() : null;
    const cleanLevel = level && VALID_LEVELS.has(level) ? level : null;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Upsert — ignore duplicates
    await supabase
      .from("race_alerts")
      .upsert(
        { email: cleanEmail, state: cleanState, level: cleanLevel },
        { onConflict: "email,state,level", ignoreDuplicates: true }
      );

    return new Response(JSON.stringify({ message: "Subscribed successfully" }), {
      headers: CORS_HEADERS,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
