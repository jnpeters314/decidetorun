/**
 * Alaska candidate importer
 *
 * Data source: Alaska Public Offices Commission (APOC) candidate reports
 * URL: https://aws.state.ak.us/apocreports/campaign/AllCandidates.aspx?type=all&Elections=2026
 *
 * The APOC site is ASP.NET WebForms — it requires ViewState session management to paginate.
 * Strategy: GET the first page to capture ViewState/cookies, extract all page-navigation
 * doPostBack targets, then POST to each one sequentially.
 *
 * Filing deadline: June 1, 2026
 * Primary date:    August 18, 2026
 *
 * How to trigger:
 *   curl -X POST https://pmiqbxxvoabowwiedrej.supabase.co/functions/v1/import-alaska
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const APOC_URL = "https://aws.state.ak.us/apocreports/campaign/AllCandidates.aspx?type=all&Elections=2026";

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
    // Step 1: GET initial page — captures ViewState and session cookies
    const initRes = await fetch(APOC_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DTR-importer/1.0)" },
      redirect: "follow",
    });

    if (!initRes.ok) {
      return new Response(
        JSON.stringify({ error: `APOC initial fetch failed: ${initRes.status}` }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const initHtml = await initRes.text();
    const sessionCookie = extractSessionCookie(initRes.headers.get("set-cookie") ?? "");

    const viewState = extractHidden(initHtml, "__VIEWSTATE");
    const viewStateGen = extractHidden(initHtml, "__VIEWSTATEGENERATOR");
    const eventValidation = extractHidden(initHtml, "__EVENTVALIDATION");

    if (!viewState) {
      return new Response(
        JSON.stringify({
          error: "Could not extract ViewState from APOC page",
          hint: "ASP.NET page structure may have changed",
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Collect candidates — start with page 1
    const allCandidates: ApocRow[] = [];
    allCandidates.push(...parseApocRows(initHtml));

    // Use a queue + visited-set: Telerik's pager only shows a window of pages
    // at a time, so new targets for later pages appear as we navigate forward.
    const visited = new Set<string>();
    const queue = extractPageTargets(initHtml);
    queue.forEach((t) => visited.add(t));

    let currentViewState = viewState;
    let currentViewStateGen = viewStateGen;
    let currentEventValidation = eventValidation;
    let currentCookie = sessionCookie;
    let pagesFetched = 1;

    while (queue.length > 0) {
      const eventTarget = queue.shift()!;

      const formBody = new URLSearchParams({
        __EVENTTARGET: eventTarget,
        __EVENTARGUMENT: "",
        __VIEWSTATE: currentViewState,
        __VIEWSTATEGENERATOR: currentViewStateGen,
        __EVENTVALIDATION: currentEventValidation,
      });

      const pageRes = await fetch(APOC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (compatible; DTR-importer/1.0)",
          ...(currentCookie ? { Cookie: currentCookie } : {}),
        },
        body: formBody.toString(),
        redirect: "follow",
      });

      if (!pageRes.ok) break;

      const pageHtml = await pageRes.text();

      currentViewState = extractHidden(pageHtml, "__VIEWSTATE") || currentViewState;
      currentViewStateGen = extractHidden(pageHtml, "__VIEWSTATEGENERATOR") || currentViewStateGen;
      currentEventValidation = extractHidden(pageHtml, "__EVENTVALIDATION") || currentEventValidation;
      const newCookie = pageRes.headers.get("set-cookie");
      if (newCookie) currentCookie = extractSessionCookie(newCookie);

      const pageCandidates = parseApocRows(pageHtml);
      if (pageCandidates.length === 0) break;
      allCandidates.push(...pageCandidates);
      pagesFetched++;

      // Enqueue any newly-visible page targets not yet visited
      for (const t of extractPageTargets(pageHtml)) {
        if (!visited.has(t)) {
          visited.add(t);
          queue.push(t);
        }
      }
    }

    const rawMapped = allCandidates.map(mapApocRecord).filter(Boolean) as NonNullable<ReturnType<typeof mapApocRecord>>[];

    if (rawMapped.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No Alaska 2026 candidates found — filing may not have opened yet",
          pages_fetched: pagesFetched,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // Deduplicate within batch before upsert
    const seen = new Map<string, NonNullable<ReturnType<typeof mapApocRecord>>>();
    for (const c of rawMapped) {
      const key = `${c.office_title}|${c.district ?? ""}|${c.candidate_name}`;
      seen.set(key, c);
    }
    const mapped = Array.from(seen.values());

    const { error } = await supabase.from("sos_candidates").upsert(mapped, {
      onConflict: "state,election_year,office_title,district,candidate_name",
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Alaska import complete", count: mapped.length, pages: pagesFetched }),
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});

// Extract the doPostBack event targets for all pagination links in the pager.
// APOC uses Telerik RadGrid with HTML-encoded quotes:
//   doPostBack(&#39;M$C$grid$ctl00$ctl03$ctl01$ctl05&#39;,&#39;&#39;)
function extractPageTargets(html: string): string[] {
  const targets: string[] = [];
  // Match HTML-encoded single-quote variant used by APOC
  const pattern = /doPostBack\(&#39;([^&]+)&#39;,&#39;&#39;\)/g;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const target = m[1];
    if (!targets.includes(target)) {
      targets.push(target);
    }
  }
  return targets;
}

// Extract a hidden input's value by field name
function extractHidden(html: string, name: string): string {
  const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i"))
    ?? html.match(new RegExp(`id="${name}"[^>]*value="([^"]*)"`, "i"));
  if (!m) return "";
  // ViewState values use + for space in URL encoding but are passed as raw form values
  return m[1].replace(/&#43;/g, "+").replace(/&amp;/g, "&");
}

// Extract ASP.NET_SessionId from Set-Cookie header
function extractSessionCookie(setCookieHeader: string): string {
  const m = setCookieHeader.match(/ASP\.NET_SessionId=([^;]+)/i);
  return m ? `ASP.NET_SessionId=${m[1]}` : "";
}

interface ApocRow {
  name: string;
  office: string;
  jurisdiction: string;
}

// Parse candidate rows from APOC HTML table
function parseApocRows(html: string): ApocRow[] {
  const rows: ApocRow[] = [];

  // APOC uses Telerik RadGrid — rows have class "rgRow" or "rgAltRow"
  const trPattern = /<tr[^>]*class="rg(?:Alt)?Row"[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      cells.push(stripTags(tdMatch[1]).trim());
    }
    if (cells.length >= 2 && cells[0]) {
      rows.push({
        name: cells[0],
        office: cells[1] ?? "",
        jurisdiction: cells[2] ?? "",
      });
    }
  }

  // Fallback: linked candidate name pattern
  if (rows.length === 0) {
    const fallback = /<tr[^>]*>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/gi;
    let m;
    while ((m = fallback.exec(html)) !== null) {
      rows.push({ name: m[1].trim(), office: m[2].trim(), jurisdiction: m[3].trim() });
    }
  }

  return rows;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

function mapApocRecord(r: ApocRow) {
  if (!r.name || !r.office) return null;

  return {
    state: "AK",
    election_year: 2026,
    office_title: r.office.trim(),
    district: r.jurisdiction?.trim() || null,
    level: inferLevel(r.office),
    candidate_name: formatName(r.name),
    party: null, // Alaska uses a nonpartisan blanket primary
    status: "filed",
    filing_date: null,
    source: "alaska_apoc",
    source_id: null,
  };
}

// Convert "Last, First" → "First Last"
function formatName(raw: string): string {
  const comma = raw.indexOf(",");
  if (comma === -1) return raw.trim();
  const last = raw.slice(0, comma).trim();
  const first = raw.slice(comma + 1).trim();
  return `${first} ${last}`.trim();
}

function inferLevel(office: string): string {
  const o = office.toLowerCase();
  if (o.includes("u.s. rep") || o.includes("u.s. sen") || o.includes("congress")) return "federal";
  if (o.includes("governor") || o.includes("lieutenant governor") ||
      o.includes("attorney general") || o.includes("state commissioner")) return "statewide";
  if (o.includes("house") || o.includes("senate") || o.includes("representative") ||
      o.includes("senator")) return "state";
  return "local";
}
