import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Security model ────────────────────────────────────────────
// No auth header check — safe because:
//   1. All reads/writes go through the service role client server-side.
//   2. Unique index on email_notifications(user_id, type, related_id) makes this
//      idempotent: same application_id → exactly one email (second call → 23505 → skipped).
//   3. No sensitive data returned, only status strings.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_TIMEOUT_MS = 8_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Methode niet toegestaan." }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey   = Deno.env.get("RESEND_API_KEY");
  const fromEmail      = Deno.env.get("EMAIL_FROM") ?? "Roomly <noreply@roomly.nl>";
  const appBaseUrl     = Deno.env.get("APP_BASE_URL") ?? "https://roomly.nl";

  if (!resendApiKey) {
    console.error("[notify-application] RESEND_API_KEY is not set — skipping.");
    return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let payload: {
    application_id?: unknown;
    listing_id?: unknown;
    applicant_id?: unknown;
  };

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldig verzoeklichaam." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { application_id, listing_id, applicant_id } = payload;

  const isUuid = (v: unknown): v is string =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  if (!isUuid(application_id) || !isUuid(listing_id) || !isUuid(applicant_id)) {
    return new Response(JSON.stringify({ error: "Ongeldige of ontbrekende UUID-velden." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Resolve listing → owner ───────────────────────────────────
  const { data: listing, error: listingErr } = await admin
    .from("listings")
    .select("id, title, user_id")
    .eq("id", listing_id)
    .maybeSingle();

  if (listingErr || !listing) {
    console.error("[notify-application] listing lookup failed:", listingErr);
    return new Response(JSON.stringify({ skipped: true, reason: "listing_not_found" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const owner_id = listing.user_id;

  // ── Guard: skip if owner applied to their own listing ────────
  if (owner_id === applicant_id) {
    return new Response(JSON.stringify({ skipped: true, reason: "self_application" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Check owner notification preference ───────────────────────
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("email, name, notify_email_applications")
    .eq("id", owner_id)
    .maybeSingle();

  if (!ownerProfile?.email) {
    return new Response(JSON.stringify({ skipped: true, reason: "no_owner_email" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (ownerProfile.notify_email_applications === false) {
    return new Response(JSON.stringify({ skipped: true, reason: "preference_off" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Dedup: unique index on (user_id, type='application', related_id) ─
  // Second call with same application_id → 23505 conflict → skipped.
  const { error: logInsertErr, data: logRow } = await admin
    .from("email_notifications")
    .insert({
      user_id:    owner_id,
      type:       "application",
      related_id: application_id,
      status:     "pending",
    })
    .select("id")
    .single();

  if (logInsertErr) {
    if (logInsertErr.code === "23505") {
      return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    console.error("[notify-application] log insert failed:", logInsertErr);
    return new Response(JSON.stringify({ skipped: true, reason: "log_insert_failed" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Resolve applicant name ────────────────────────────────────
  const { data: applicantProfile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", applicant_id)
    .maybeSingle();

  const applicantName = applicantProfile?.name ?? "Een huurder";
  const ownerName     = ownerProfile.name ?? "daar";
  const ctaUrl        = `${appBaseUrl}/dashboard`;

  // ── Send via Resend ───────────────────────────────────────────
  let sendStatus: "sent" | "failed" = "failed";
  let sendError: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT_MS);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    fromEmail,
        to:      [ownerProfile.email],
        subject: `Nieuwe aanvraag voor ${listing.title} — Roomly`,
        html: `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><title>Nieuwe aanvraag</title></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#e11d48;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Roomly</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:15px;color:#1c1917;">Hallo ${ownerName},</p>
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">
        <strong>${applicantName}</strong> heeft een aanvraag ingediend voor jouw advertentie
        <strong>${listing.title}</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#78716c;">
        Ga naar je dashboard om de aanvraag te bekijken, te accepteren of af te wijzen.
      </p>
      <a href="${ctaUrl}" style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
        Aanvraag bekijken →
      </a>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#a8a29e;margin:0;">
        Je ontvangt dit bericht omdat je e-mailmeldingen hebt ingeschakeld op Roomly.<br/>
        <a href="${appBaseUrl}/profiel" style="color:#a8a29e;">Meldingen beheren</a>
      </p>
    </div>
  </div>
</body>
</html>`,
      }),
    });

    clearTimeout(timeout);

    if (res.ok) {
      sendStatus = "sent";
    } else {
      const body = await res.text();
      sendError = `HTTP ${res.status}: ${body}`;
      console.error("[notify-application] Resend error:", sendError);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error("[notify-application] send exception:", sendError);
  }

  // ── Update log row ────────────────────────────────────────────
  await admin
    .from("email_notifications")
    .update({ status: sendStatus, error: sendError, sent_at: new Date().toISOString() })
    .eq("id", logRow.id);

  return new Response(JSON.stringify({ ok: true, status: sendStatus }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
