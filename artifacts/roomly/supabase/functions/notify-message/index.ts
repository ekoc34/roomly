import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEBOUNCE_MINUTES = 10;
const FUNCTION_TIMEOUT_MS = 8_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret    = Deno.env.get("EMAIL_WEBHOOK_SECRET");
  const resendApiKey     = Deno.env.get("RESEND_API_KEY");
  const fromEmail        = Deno.env.get("EMAIL_FROM") ?? "Roomly <noreply@roomly.nl>";
  const appBaseUrl       = Deno.env.get("APP_BASE_URL") ?? "https://roomly.nl";

  // ── Authenticate: validate the webhook secret from the DB trigger ──
  // The database trigger sends Bearer <EMAIL_WEBHOOK_SECRET>.
  // The Supabase service role key is never stored in the database.
  if (!webhookSecret) {
    console.error("[notify-message] EMAIL_WEBHOOK_SECRET is not configured.");
    return new Response(JSON.stringify({ error: "Serverconfiguratie ontbreekt." }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== webhookSecret) {
    return new Response(JSON.stringify({ error: "Ongeautoriseerd." }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!resendApiKey) {
    console.error("[notify-message] RESEND_API_KEY is not set — skipping.");
    return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let payload: {
    message_id: string;
    conversation_id: string;
    sender_id: string;
    body_preview: string;
  };

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldig verzoeklichaam." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { message_id, conversation_id, sender_id, body_preview } = payload;
  if (!message_id || !conversation_id || !sender_id) {
    return new Response(JSON.stringify({ error: "Ontbrekende velden." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Use service role key internally to bypass RLS ─────────────
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Resolve conversation → find recipient ─────────────────────
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("id, tenant_id, landlord_id, listing_id, listings(title)")
    .eq("id", conversation_id)
    .maybeSingle();

  if (convErr || !conv) {
    console.error("[notify-message] conversation lookup failed:", convErr);
    return new Response(JSON.stringify({ skipped: true, reason: "conversation_not_found" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const recipient_id = sender_id === conv.tenant_id ? conv.landlord_id : conv.tenant_id;

  // ── Check recipient's email notification preference ───────────
  const { data: recipientProfile } = await admin
    .from("profiles")
    .select("email, name, notify_email_messages")
    .eq("id", recipient_id)
    .maybeSingle();

  if (!recipientProfile?.email) {
    return new Response(JSON.stringify({ skipped: true, reason: "no_recipient_email" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (recipientProfile.notify_email_messages === false) {
    return new Response(JSON.stringify({ skipped: true, reason: "preference_off" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Check if message was already read (recipient had conv open) ─
  const { data: msg } = await admin
    .from("messages")
    .select("read_at")
    .eq("id", message_id)
    .maybeSingle();

  if (msg?.read_at) {
    return new Response(JSON.stringify({ skipped: true, reason: "already_read" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Debounce: max 1 email per conversation per DEBOUNCE_MINUTES ─
  const debounceWindow = new Date(Date.now() - DEBOUNCE_MINUTES * 60 * 1_000).toISOString();
  const { data: recentEmail } = await admin
    .from("email_notifications")
    .select("id")
    .eq("user_id", recipient_id)
    .eq("type", "message")
    .eq("related_id", conversation_id)
    .eq("status", "sent")
    .gte("sent_at", debounceWindow)
    .maybeSingle();

  if (recentEmail) {
    return new Response(JSON.stringify({ skipped: true, reason: "debounced" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Resolve sender name ───────────────────────────────────────
  const { data: senderProfile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", sender_id)
    .maybeSingle();

  const senderName    = senderProfile?.name ?? "Iemand";
  const recipientName = recipientProfile.name ?? "daar";
  const listingTitle  = (conv.listings as { title: string } | null)?.title ?? "een woning";
  const ctaUrl        = `${appBaseUrl}/berichten/${conversation_id}`;
  const preview       = (body_preview ?? "").slice(0, 120);

  // ── Insert pending log row ────────────────────────────────────
  const { data: logRow, error: logInsertErr } = await admin
    .from("email_notifications")
    .insert({
      user_id:    recipient_id,
      type:       "message",
      related_id: conversation_id,
      status:     "pending",
    })
    .select("id")
    .single();

  if (logInsertErr) {
    console.error("[notify-message] log insert failed:", logInsertErr);
    return new Response(JSON.stringify({ skipped: true, reason: "log_insert_failed" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Send via Resend ───────────────────────────────────────────
  let sendStatus: "sent" | "failed" = "failed";
  let sendError: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT_MS);

    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    fromEmail,
        to:      [recipientProfile.email],
        subject: `Nieuw bericht van ${senderName} — Roomly`,
        html: `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><title>Nieuw bericht</title></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#e11d48;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Roomly</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:15px;color:#1c1917;">Hallo ${recipientName},</p>
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">
        <strong>${senderName}</strong> heeft je een bericht gestuurd over <strong>${listingTitle}</strong>:
      </p>
      <blockquote style="margin:0 0 24px;padding:14px 18px;background:#fef2f2;border-left:4px solid #e11d48;border-radius:6px;color:#57534e;font-size:14px;line-height:1.6;">
        ${preview}${preview.length >= 120 ? "…" : ""}
      </blockquote>
      <a href="${ctaUrl}"
         style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
        Bericht lezen →
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
      console.error("[notify-message] Resend error:", sendError);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error("[notify-message] send exception:", sendError);
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
