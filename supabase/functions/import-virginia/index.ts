/**
 * Virginia ELECT candidate importer
 *
 * Data source: Virginia Department of Elections (ELECT)
 * Candidate list page: https://www.elections.virginia.gov/casting-a-ballot/candidate-list/
 * Format: Excel (.xlsx) — files are revised frequently during the filing window
 *
 * Strategy: fetch the candidate-list HTML page, extract current .xlsx URLs for the
 * August 2026 primary, download and parse each file with SheetJS, then upsert.
 *
 * Filing window: January 2 – May 26, 2026
 * Primary date:  August 4, 2026
 *
 * How to trigger:
 *   curl -X POST https://pmiqbxxvoabowwiedrej.supabase.co/functions/v1/import-virginia
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ELECT_BASE = "https://www.elections.virginia.gov";
const CANDIDATE_LIST_PAGE = `${ELECT_BASE}/casting-a-ballot/candidate-list/`;

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Step 1: Fetch the candidate list page and find current .xlsx URLs
    const pageRes = await fetch(CANDIDATE_LIST_PAGE, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DTR-importer/1.0)" },
    });
    if (!pageRes.ok) {
      return new Response(
        JSON.stringify({ error: `ELECT page fetch failed: ${pageRes.status}` }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const html = await pageRes.text();

    // Extract all .xlsx hrefs that look like 2026 primary candidate lists
    const xlsxPattern = /href="([^"]*2026[^"]*(?:Primary|primary|Candidate|candidate)[^"]*\.xlsx)"/g;
    const xlsxUrls: string[] = [];
    let match;
    while ((match = xlsxPattern.exec(html)) !== null) {
      const href = match[1];
      const url = href.startsWith("http") ? href : `${ELECT_BASE}${href}`;
      if (!xlsxUrls.includes(url)) xlsxUrls.push(url);
    }

    if (xlsxUrls.length === 0) {
      // Fallback: look for any .xlsx on the page
      const fallbackPattern = /href="([^"]*\.xlsx)"/g;
      while ((match = fallbackPattern.exec(html)) !== null) {
        const href = match[1];
        const url = href.startsWith("http") ? href : `${ELECT_BASE}${href}`;
        if (!xlsxUrls.includes(url)) xlsxUrls.push(url);
      }
    }

    if (xlsxUrls.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No .xlsx candidate list files found on ELECT page — filing may not have opened yet",
          page_url: CANDIDATE_LIST_PAGE,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // Step 2: Download and parse each xlsx file
    let totalImported = 0;
    const fileResults: { url: string; count: number }[] = [];

    for (const url of xlsxUrls) {
      const xlsxRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DTR-importer/1.0)" },
      });
      if (!xlsxRes.ok) continue;

      const arrayBuffer = await xlsxRes.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName],
        { defval: "" }
      );

      if (rows.length === 0) continue;

      // Detect party from filename (Dem/Rep)
      const urlLower = url.toLowerCase();
      const partyHint = urlLower.includes("dem") ? "Democratic"
        : urlLower.includes("rep") ? "Republican"
        : null;

      const candidates = rows.map((r) => mapVaRow(r, partyHint)).filter(Boolean) as ReturnType<typeof mapVaRow>[];

      if (candidates.length === 0) continue;

      const { error } = await supabase.from("sos_candidates").upsert(candidates, {
        onConflict: "state,election_year,office_title,district,candidate_name",
      });
      if (error) throw error;

      totalImported += candidates.length;
      fileResults.push({ url, count: candidates.length });
    }

    return new Response(
      JSON.stringify({
        message: "Virginia import complete",
        count: totalImported,
        files: fileResults,
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

function mapVaRow(r: Record<string, unknown>, partyHint: string | null) {
  // Virginia ELECT uses varied column names — try common variants
  const name = str(
    r["Candidate Name"] ?? r["Name"] ?? r["CANDIDATE NAME"] ?? r["CandidateName"] ?? ""
  );
  const office = str(
    r["Office"] ?? r["Office Sought"] ?? r["OFFICE"] ?? r["Office Title"] ?? r["Position"] ?? ""
  );
  const district = str(
    r["District"] ?? r["District Number"] ?? r["DISTRICT"] ?? r["Jurisdiction"] ?? ""
  ) || null;
  const party = str(
    r["Party"] ?? r["Party Designation"] ?? r["PARTY"] ?? r["PartyDesignation"] ?? ""
  ) || partyHint || null;
  const filingDate = str(r["Filing Date"] ?? r["Date Filed"] ?? r["FILING DATE"] ?? "") || null;

  if (!name || !office) return null;

  return {
    state: "VA",
    election_year: 2026,
    office_title: normalizeOffice(office),
    district: district || null,
    level: inferLevel(office),
    candidate_name: name.trim(),
    party: normalizeParty(party ?? ""),
    status: "filed",
    filing_date: filingDate ? parseDate(filingDate) : null,
    source: "virginia_elect",
    source_id: null,
  };
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeOffice(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (o.includes("u.s. rep") || o.includes("u.s. sen") || o.includes("congress")) return "federal";
  if (
    o.includes("governor") || o.includes("lieutenant governor") ||
    o.includes("attorney general") || o.includes("commissioner of agriculture") ||
    o.includes("state corporation")
  ) return "statewide";
  if (o.includes("senate") || o.includes("house of delegates") || o.includes("delegate")) return "state";
  return "local";
}

function normalizeParty(raw: string): string | null {
  const p = raw.toUpperCase();
  if (p.includes("DEM")) return "Democratic";
  if (p.includes("REP")) return "Republican";
  if (p.includes("IND")) return "Independent";
  if (p.includes("LIB")) return "Libertarian";
  if (p.includes("GREEN")) return "Green";
  return raw || null;
}

function parseDate(raw: string): string | null {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}
