/**
 * flag-submission
 *
 * Increments reported_count on a submitted_races row.
 * If reported_count reaches 3, status is set to 'flagged' for manual review.
 * Uses the same honeypot-style silent approach — always returns 200 to the client.
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

const FLAG_THRESHOLD = 3; // auto-flag after this many reports

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
    const { id } = await req.json();
    if (!id || typeof id !== "string") {
      return new Response(JSON.stringify({ error: "id is required" }), {
        status: 400, headers: CORS_HEADERS,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch current count
    const { data: row, error: fetchErr } = await supabase
      .from("submitted_races")
      .select("id, reported_count, status")
      .eq("id", id)
      .eq("status", "published") // only published rows can be flagged
      .single();

    if (fetchErr || !row) {
      // Don't reveal whether the row exists
      return new Response(JSON.stringify({ message: "ok" }), { headers: CORS_HEADERS });
    }

    const newCount = (row.reported_count ?? 0) + 1;
    const newStatus = newCount >= FLAG_THRESHOLD ? "flagged" : row.status;

    await supabase
      .from("submitted_races")
      .update({ reported_count: newCount, status: newStatus })
      .eq("id", id);

    return new Response(JSON.stringify({ message: "ok" }), { headers: CORS_HEADERS });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
