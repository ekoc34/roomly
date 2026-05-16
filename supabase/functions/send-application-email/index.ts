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

  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "re_placeholder_replace_me";
  const fromEmail    = Deno.env.get("EMAIL_FROM") ?? "Welkthuis <noreply@welkthuis.nl>";
  const appBaseUrl   = Deno.env.get("APP_BASE_URL") ?? "https://welkthuis.nl";

  let payload: {
    landlord_email?:      unknown;
    listing_title?:       unknown;
    application_message?: unknown;
  };

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldig verzoeklichaam." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { landlord_email, listing_title, application_message } = payload;

  if (typeof landlord_email !== "string" || !landlord_email.includes("@")) {
    return new Response(JSON.stringify({ error: "Ongeldig of ontbrekend e-mailadres." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const title   = typeof listing_title === "string" && listing_title.trim()
    ? listing_title.trim()
    : "jouw advertentie";
  const preview = typeof application_message === "string"
    ? application_message.slice(0, 200) + (application_message.length > 200 ? "…" : "")
    : "";

  const ctaUrl = `${appBaseUrl}/dashboard`;

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
        to:      [landlord_email],
        subject: `Nieuwe aanvraag op je advertentie — Welkthuis`,
        html: `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><title>Nieuwe aanvraag</title></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#e11d48;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Welkthuis</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#1c1917;">
        Je hebt een nieuwe aanvraag ontvangen op <strong>${title}</strong>.
      </p>
      ${preview ? `
      <div style="background:#f5f5f4;border-left:3px solid #e11d48;border-radius:4px;padding:14px 16px;margin:0 0 24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#a8a29e;">Bericht van de aanvrager</p>
        <p style="margin:0;font-size:14px;color:#44403c;line-height:1.6;">${preview}</p>
      </div>` : ""}
      <p style="margin:0 0 24px;font-size:14px;color:#78716c;">
        Ga naar je dashboard om de aanvraag te bekijken, te accepteren of af te wijzen.
      </p>
      <a href="${ctaUrl}" style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
        Aanvraag bekijken →
      </a>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#a8a29e;margin:0;">
        Je ontvangt dit bericht omdat je e-mailmeldingen hebt ingeschakeld op Welkthuis.<br/>
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
      console.error("[send-application-email] Resend error:", sendError);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error("[send-application-email] send exception:", sendError);
  }

  return new Response(
    JSON.stringify({ ok: sendStatus === "sent", status: sendStatus, error: sendError }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
