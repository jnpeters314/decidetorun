import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Census2020_Current&layers=54,56,58&format=json`
    );
    const data = await res.json();
    const geos = data?.result?.geographies ?? {};

    const cdKey = Object.keys(geos).find((k) => k.toLowerCase().includes("congressional"));
    const congressionalDistrict =
      cdKey && geos[cdKey][0]
        ? parseInt(geos[cdKey][0].DISTRICT || geos[cdKey][0].BASENAME, 10)
        : null;

    const senateKey = Object.keys(geos).find((k) => k.toLowerCase().includes("upper"));
    const stateSenateDistrict =
      senateKey && geos[senateKey][0]
        ? parseInt(geos[senateKey][0].DISTRICT || geos[senateKey][0].BASENAME, 10)
        : null;

    const houseKey = Object.keys(geos).find((k) => k.toLowerCase().includes("lower"));
    const stateHouseDistrict =
      houseKey && geos[houseKey][0]
        ? parseInt(geos[houseKey][0].DISTRICT || geos[houseKey][0].BASENAME, 10)
        : null;

    return new Response(
      JSON.stringify({ congressionalDistrict, stateSenateDistrict, stateHouseDistrict }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
