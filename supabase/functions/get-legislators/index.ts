import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const OPENSTATES_API_KEY = Deno.env.get("OPENSTATES_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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

  try {
    const { lat, lng } = await req.json();

    const res = await fetch(
      `https://v3.openstates.org/people/geo?lat=${lat}&lng=${lng}`,
      { headers: { "X-API-KEY": OPENSTATES_API_KEY } }
    );

    if (!res.ok) {
      throw new Error(`OpenStates error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();

    // Normalize to just the fields we need
    const legislators = (data.results ?? []).map((p: Record<string, unknown>) => {
      const role = p.current_role as Record<string, string> | null;
      return {
        name: p.name,
        party: p.party,
        chamber: role?.org_classification ?? null,   // "upper" or "lower"
        district: role?.district ?? null,
        title: role?.title ?? null,
      };
    });

    return new Response(JSON.stringify(legislators), { headers: CORS_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
