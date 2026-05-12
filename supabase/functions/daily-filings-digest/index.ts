/**
 * daily-filings-digest
 *
 * Queries sos_candidates for records created in the past 24 hours and sends
 * a summary email via Resend.
 *
 * Required Supabase secrets:
 *   RESEND_API_KEY  — from resend.com dashboard
 *
 * Required Resend setup:
 *   Verify the decidetorun.com domain in Resend (Settings → Domains → Add Domain)
 *   and add the DNS TXT record in Cloudflare before the first send.
 *
 * How to trigger manually:
 *   curl -X POST https://pmiqbxxvoabowwiedrej.supabase.co/functions/v1/daily-filings-digest
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const FROM_EMAIL = "jaime@decidetorun.com";
const TO_EMAIL = "jaime@decidetorun.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const LEVEL_LABEL: Record<string, string> = {
  federal: "Federal",
  statewide: "Statewide",
  state: "State Legislature",
  local: "Local",
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

interface Candidate {
  state: string;
  election_year: number;
  office_title: string;
  district: string | null;
  level: string;
  candidate_name: string;
  party: string | null;
  status: string;
  filing_date: string | null;
  source: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY secret not set in Supabase dashboard" }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("sos_candidates")
    .select("state, election_year, office_title, district, level, candidate_name, party, status, filing_date, source, created_at")
    .gte("created_at", since)
    .order("state", { ascending: true })
    .order("level", { ascending: true })
    .order("office_title", { ascending: true })
    .order("candidate_name", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: CORS_HEADERS,
    });
  }

  const filings = (candidates ?? []) as Candidate[];
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles",
  });

  const html = buildEmail(filings, dateLabel);
  const subject = filings.length > 0
    ? `${filings.length} New Candidate Filing${filings.length === 1 ? "" : "s"} — ${dateLabel}`
    : `No New Candidate Filings — ${dateLabel}`;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const resendError = await resendRes.text();
    return new Response(
      JSON.stringify({ error: "Resend API error", detail: resendError }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  return new Response(
    JSON.stringify({ message: "Digest sent", count: filings.length, subject }),
    { headers: CORS_HEADERS }
  );
});

function buildEmail(filings: Candidate[], dateLabel: string): string {
  const header = `
    <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;color:#ffffff;font-family:sans-serif;font-weight:600;">
        Decide to Run — Daily Filings Digest
      </h1>
      <p style="margin:4px 0 0;color:#a0aec0;font-size:14px;font-family:sans-serif;">${dateLabel}</p>
    </div>`;

  if (filings.length === 0) {
    return `
      <div style="font-family:sans-serif;max-width:680px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        ${header}
        <div style="padding:32px;background:#ffffff;">
          <p style="color:#4a5568;font-size:15px;margin:0;">No new candidate filings in the past 24 hours.</p>
        </div>
      </div>`;
  }

  // Group by state
  const byState = new Map<string, Candidate[]>();
  for (const c of filings) {
    if (!byState.has(c.state)) byState.set(c.state, []);
    byState.get(c.state)!.push(c);
  }

  const stateSections = Array.from(byState.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, candidates]) => {
      const rows = candidates.map((c) => {
        const district = c.district ? ` (District ${c.district})` : "";
        const party = c.party ? `<span style="color:#718096;font-size:12px;"> — ${c.party}</span>` : "";
        const level = LEVEL_LABEL[c.level] ?? c.level;
        const filingDate = c.filing_date
          ? new Date(c.filing_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "—";
        const source = c.source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f7fafc;font-size:14px;color:#1a202c;font-weight:500;">
              ${c.candidate_name}${party}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #f7fafc;font-size:14px;color:#4a5568;">
              ${c.office_title}${district}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #f7fafc;font-size:13px;color:#718096;">${level}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f7fafc;font-size:13px;color:#718096;">${filingDate}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f7fafc;font-size:13px;color:#718096;">${source}</td>
          </tr>`;
      }).join("");

      return `
        <div style="margin-bottom:32px;">
          <h2 style="font-size:15px;font-weight:700;color:#2d3748;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">
            ${STATE_NAMES[state] ?? state} (${candidates.length})
          </h2>
          <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f7fafc;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Candidate</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Office</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Level</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Filed</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Source</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join("");

  return `
    <div style="font-family:sans-serif;max-width:720px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      ${header}
      <div style="padding:32px;background:#f8fafc;">
        <p style="margin:0 0 24px;font-size:15px;color:#4a5568;">
          <strong style="color:#1a202c;">${filings.length} new filing${filings.length === 1 ? "" : "s"}</strong> recorded in the past 24 hours across ${byState.size} state${byState.size === 1 ? "" : "s"}.
        </p>
        ${stateSections}
        <p style="margin:24px 0 0;font-size:12px;color:#a0aec0;border-top:1px solid #e2e8f0;padding-top:16px;">
          Decide to Run · Data sourced from state Secretaries of State and FEC · Sent daily M–F at 7am PT
        </p>
      </div>
    </div>`;
}
