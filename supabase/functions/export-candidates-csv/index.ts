/**
 * export-candidates-csv
 *
 * Returns all sos_candidates as a downloadable CSV file.
 * Optionally filter by state(s) and/or level(s).
 *
 * Examples:
 *   curl .../export-candidates-csv                          → all candidates
 *   curl ".../export-candidates-csv?states=AZ,MI,OH"       → three states
 *   curl ".../export-candidates-csv?states=AZ&level=state" → AZ state races only
 *
 * No JWT required — disable JWT verification in Supabase dashboard.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const COLUMNS = [
  "state",
  "election_year",
  "level",
  "office_title",
  "district",
  "candidate_name",
  "party",
  "status",
  "filing_date",
  "source",
  "created_at",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const url = new URL(req.url);
  const statesParam = url.searchParams.get("states");
  const levelParam = url.searchParams.get("level");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const states = statesParam
    ? statesParam.toUpperCase().split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  // Paginate in batches of 1000 to bypass Supabase's default row cap
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("sos_candidates")
      .select(COLUMNS.join(","))
      .order("state", { ascending: true })
      .order("level", { ascending: true })
      .order("office_title", { ascending: true })
      .order("candidate_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (states) query = query.in("state", states);
    if (levelParam) query = query.eq("level", levelParam.toLowerCase());

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  const csv = buildCsv(rows);

  const filename = buildFilename(statesParam, levelParam);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
});

function buildCsv(rows: Record<string, unknown>[]): string {
  const header = COLUMNS.map(csvEscape).join(",");
  if (rows.length === 0) return header + "\n";

  const lines = rows.map((row) =>
    COLUMNS.map((col) => csvEscape(String(row[col] ?? ""))).join(",")
  );

  return [header, ...lines].join("\n") + "\n";
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildFilename(states: string | null, level: string | null): string {
  const date = new Date().toISOString().split("T")[0];
  const parts = ["candidates"];
  if (states) parts.push(states.toLowerCase().replace(/,/g, "-"));
  if (level) parts.push(level);
  parts.push(date);
  return parts.join("_") + ".csv";
}
