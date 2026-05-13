// Supabase Edge Function: stripe-webhook
// Deployed with --no-verify-jwt so Stripe can POST without an Authorization header.
//
// ── DEPLOYMENT ───────────────────────────────────────────────────────────────
//   1. Run migration_stripe_idempotency.sql in the Supabase SQL Editor first.
//   2. supabase functions deploy stripe-webhook --no-verify-jwt
//
// ── REQUIRED SECRETS (set via Supabase Dashboard › Settings › Edge Functions) ─
//   STRIPE_SECRET_KEY       →  sk_live_...
//   STRIPE_WEBHOOK_SECRET   →  whsec_...  (Stripe Dashboard › Webhooks › Signing secret)
//   SUPABASE_SERVICE_ROLE_KEY is auto-injected by Supabase.
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Read the raw body FIRST — before any other awaits — so the buffer is intact
  // for Stripe signature verification.
  const rawBody = await req.text();

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
      console.error("Missing required environment variables.");
      return new Response(JSON.stringify({ error: "Server misconfiguration." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const signature = req.headers.get("stripe-signature") ?? "";

    // Verify the Stripe webhook signature to prevent spoofed requests.
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Received Stripe event: ${event.type} (${event.id})`);

    // ── Idempotency check ─────────────────────────────────────────────────────
    // Attempt to record this event ID. If the INSERT hits a conflict (duplicate
    // primary key) it inserts nothing and returns an empty array. We treat that
    // as "already processed" and return 200 immediately — safe for Stripe retries.
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inserted, error: idempotencyErr } = await adminClient
      .from("stripe_processed_events")
      .insert({ event_id: event.id, event_type: event.type })
      .select("event_id");

    if (idempotencyErr) {
      console.error("Idempotency check failed:", idempotencyErr);
      // Fail open: if we cannot check, return 500 so Stripe retries later.
      return new Response(JSON.stringify({ error: "Idempotency check failed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!inserted || inserted.length === 0) {
      // Duplicate event — already handled. Acknowledge without processing.
      console.log(`Duplicate event skipped: ${event.id}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits ?? "0", 10);

      if (!userId || credits <= 0) {
        console.error("Missing or invalid metadata in session:", session.id);
        return new Response(JSON.stringify({ error: "Missing metadata." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use the service role client (bypasses RLS) to atomically credit the user.
      const { error: rpcErr } = await adminClient.rpc("admin_add_boost_credits", {
        p_user_id: userId,
        p_credits: credits,
      });

      if (rpcErr) {
        console.error("Failed to add boost credits:", rpcErr);
        return new Response(JSON.stringify({ error: "Failed to update credits." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`checkout.session.completed: added ${credits} credit(s) to user ${userId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
