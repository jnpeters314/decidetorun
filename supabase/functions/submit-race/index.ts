/**
 * submit-race
 *
 * Accepts community-submitted race/office info, runs bot/spam protection,
 * then uses Claude to review and classify the submission before publishing.
 *
 * Protection layers:
 *   1. Honeypot field — bots fill it, humans don't; silently drop if present
 *   2. IP rate limiting — max 3 submissions per IP per hour via submitted_races table
 *   3. Claude AI review — classifies as approved/rejected with a reason
 *
 * Status flow:
 *   honeypot hit or rate limited → silently return success (don't tip off bots)
 *   Claude approves → status = 'published', confidence = 'community_reviewed'
 *   Claude rejects  → status = 'pending',   confidence = 'community' (not shown to users)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

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

// Sanitize: strip HTML tags, trim, cap length
const sanitize = (s: string | undefined, max = 500): string | null =>
  s ? s.replace(/<[^>]*>/g, "").replace(/[^\x20-\x7E\n]/g, "").trim().slice(0, max) : null;

// Ask Claude to review the submission
async function reviewWithClaude(record: Record<string, unknown>): Promise<{
  approved: boolean;
  review_note: string;
  confidence: string;
}> {
  const prompt = `You are a moderation assistant for a civic platform called Decide to Run, which helps people discover elected offices they could run for across the United States.

A user has submitted the following race/office to add to our platform. Your job is to determine whether this is a plausible, legitimate US government office that belongs on our platform.

Submission:
- Office Name: ${record.office_title}
- Level: ${record.level}
- State: ${record.state}
- City/County: ${record.city || "(not provided)"}
- District: ${record.district || "(not provided)"}
- Filing Deadline: ${record.filing_deadline || "(not provided)"}
- Election Date: ${record.next_election || "(not provided)"}
- Source URL: ${record.source_url || "(not provided)"}
- Notes: ${record.notes || "(not provided)"}

Approve this submission if:
- The office name sounds like a real US government position (city council, school board, county commissioner, state legislature, mayor, etc.)
- The state is a valid US state
- There is no spam, profanity, or malicious content
- The fields are internally consistent (e.g., a "federal" level office isn't named "Springfield Dog Catcher")

Reject this submission if:
- The office name is clearly fake, nonsensical, or a joke
- Any field contains spam, advertising, malicious URLs, profanity, or HTML/code injection attempts
- The submission appears to be a test or bot submission with no real content
- The level and office name are wildly inconsistent

Respond with ONLY valid JSON in this exact format, nothing else:
{"approved": true, "reason": "One sentence explaining approval"}
or
{"approved": false, "reason": "One sentence explaining rejection"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);

    const data = await res.json();
    const text = (data.content?.[0]?.text ?? "").trim();
    const parsed = JSON.parse(text);

    return {
      approved: parsed.approved === true,
      review_note: parsed.reason ?? "",
      confidence: parsed.approved ? "community_reviewed" : "community",
    };
  } catch (err) {
    // If Claude is unavailable, fail open — publish with a note
    console.error("Claude review failed:", err);
    return {
      approved: true,
      review_note: "AI review unavailable — published pending manual review",
      confidence: "community",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: CORS_HEADERS,
    });
  }

  // Grab submitter IP for rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

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
      // Honeypot — real users never see or fill this field
      website,
    } = body;

    // ── 1. Honeypot check ──────────────────────────────────────────────────
    // If the hidden field is filled, it's almost certainly a bot.
    // Return a fake success so the bot doesn't know it was caught.
    if (website) {
      return new Response(
        JSON.stringify({ message: "Race submitted successfully" }),
        { headers: CORS_HEADERS }
      );
    }

    // ── 2. Validate required fields ────────────────────────────────────────
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── 3. IP rate limiting ────────────────────────────────────────────────
    // Count submissions from this IP in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("submitted_races")
      .select("id", { count: "exact", head: true })
      .eq("submitter_ip", ip)
      .gte("submitted_at", oneHourAgo);

    if ((count ?? 0) >= 3) {
      // Again, fake success — don't reveal rate limiting to bots
      return new Response(
        JSON.stringify({ message: "Race submitted successfully" }),
        { headers: CORS_HEADERS }
      );
    }

    // ── 4. Build sanitized record ──────────────────────────────────────────
    const record: Record<string, unknown> = {
      office_title: sanitize(office_title, 200)!,
      level,
      state: state.toUpperCase(),
      district: sanitize(district, 50),
      city: sanitize(city, 100),
      filing_deadline: filing_deadline || null,
      next_election: next_election || null,
      source_url: (() => {
        const u = source_url?.trim().slice(0, 500) || null;
        return u && /^https?:\/\//i.test(u) ? u : null;
      })(),
      notes: sanitize(notes, 500),
      submitter_email: submitter_email?.trim().slice(0, 200) || null,
      submitter_ip: ip,
      status: "pending",
      confidence: "community",
      total_candidates: 0,
      data_source: "community",
      submitted_at: new Date().toISOString(),
      review_note: null,
    };

    // ── 5. Claude review ───────────────────────────────────────────────────
    const review = await reviewWithClaude(record);
    record.status = review.approved ? "published" : "pending";
    record.confidence = review.confidence;
    record.review_note = review.review_note;

    // ── 6. Insert ──────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from("submitted_races")
      .insert(record)
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        message: "Race submitted successfully",
        id: data.id,
        published: review.approved,
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
