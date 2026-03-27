/**
 * FEC candidate importer
 *
 * Data source: Federal Election Commission Open FEC API
 * Docs:   https://api.open.fec.gov/developers/
 * Covers: US House and Senate candidates for all 50 states
 *
 * Requires SUPABASE secret: FEC_API_KEY
 * Get a free key at: https://api.data.gov/signup/
 *
 * How to trigger:
 *   curl -X POST https://<project>.supabase.co/functions/v1/import-fec
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FEC_API_KEY = Deno.env.get("FEC_API_KEY") ?? "DEMO_KEY";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const FEC_BASE = "https://api.open.fec.gov/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let totalImported = 0;

    // Fetch House and Senate separately; upsert each page immediately to avoid memory limits
    for (const office of ["H", "S"]) {
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const url =
          `${FEC_BASE}/candidates/?election_year=2026&office=${office}` +
          `&per_page=100&page=${page}&api_key=${FEC_API_KEY}&is_active_candidate=true`;

        const res = await fetch(url);

        if (!res.ok) {
          return new Response(
            JSON.stringify({
              error: `FEC API failed: ${res.status}`,
              office,
              page,
              hint: FEC_API_KEY === "DEMO_KEY"
                ? "FEC_API_KEY secret not set — run: npx supabase secrets set FEC_API_KEY=your_key"
                : "Check FEC_API_KEY in Supabase dashboard → Settings → Edge Functions → Secrets",
            }),
            { status: 200, headers: CORS_HEADERS }
          );
        }

        const json = await res.json();
        totalPages = json.pagination?.pages ?? 1;

        const raw = (json.results ?? [])
          .map(mapFecCandidate)
          .filter(Boolean) as NonNullable<ReturnType<typeof mapFecCandidate>>[];

        // Deduplicate within the batch by unique constraint key
        const seen = new Map<string, typeof raw[0]>();
        for (const c of raw) {
          const key = `${c.state}|${c.office_title}|${c.district ?? ""}|${c.candidate_name}`;
          seen.set(key, c);
        }
        const batch = Array.from(seen.values());

        if (batch.length > 0) {
          const { error } = await supabase.from("sos_candidates").upsert(batch, {
            onConflict: "state,election_year,office_title,district,candidate_name",
          });
          if (error) throw error;
          totalImported += batch.length;
        }

        page++;
      }
    }

    if (totalImported === 0) {
      return new Response(
        JSON.stringify({ message: "No FEC 2026 candidates found yet", count: 0 }),
        { headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ message: "FEC import complete", count: totalImported }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

function mapFecCandidate(c: Record<string, unknown>) {
  const office = (c.office as string) ?? "";
  const state = (c.state as string) ?? "";
  if (!state || !office) return null;

  const districtRaw = office === "H" ? String(c.district ?? "0").padStart(2, "0") : null;
  const districtNum = districtRaw ? parseInt(districtRaw, 10) : null;
  const officeTitle =
    office === "S"
      ? "U.S. Senate"
      : `U.S. House - District ${districtNum === 0 ? "At-Large" : districtNum}`;

  const name = formatFecName((c.name as string) ?? "");

  return {
    state,
    election_year: 2026,
    office_title: officeTitle,
    district: districtRaw,
    level: "federal",
    candidate_name: name,
    party: normalizeParty((c.party as string) ?? ""),
    status: "filed",
    filing_date: null,
    source: "fec",
    source_id: (c.candidate_id as string) ?? null,
  };
}

// FEC names are "LASTNAME, FIRSTNAME MIDDLE" — convert to "Firstname Lastname"
function formatFecName(raw: string): string {
  const comma = raw.indexOf(",");
  if (comma === -1) return titleCase(raw);
  const last = raw.slice(0, comma).trim();
  const rest = raw.slice(comma + 1).trim();
  const first = rest.split(" ")[0] ?? "";
  return `${titleCase(first)} ${titleCase(last)}`.trim();
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
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
