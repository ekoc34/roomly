// Supabase Edge Function: stripe-webhook
// Listens to Stripe events and credits Boost Credits after a confirmed payment.
//
// ── DEPLOYMENT INSTRUCTIONS ────────────────────────────────────────────────
// 1. Deploy:   supabase functions deploy stripe-webhook
// 2. In Stripe Dashboard › Developers › Webhooks, click "Add endpoint":
//    - Endpoint URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//    - Events to listen: checkout.session.completed
// 3. Copy the "Signing secret" (whsec_...) and add it as a Supabase secret:
//      supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
//
// ── REQUIRED SECRETS ────────────────────────────────────────────────────────
//    STRIPE_SECRET_KEY          →  sk_test_YOUR_STRIPE_SECRET_KEY
//    STRIPE_WEBHOOK_SECRET      →  whsec_YOUR_SIGNING_SECRET
//    SUPABASE_SERVICE_ROLE_KEY  →  (auto-injected by Supabase)
// ──────────────────────────────────────────────────────────────────────────

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey     = Deno.env.get("STRIPE_SECRET_KEY")!;
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;
    const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const stripe    = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const signature = req.headers.get("stripe-signature") ?? "";
    const rawBody   = await req.text();

    // Verify Stripe webhook signature (prevents spoofed requests)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session  = event.data.object as Stripe.Checkout.Session;
      const userId   = session.metadata?.user_id;
      const credits  = parseInt(session.metadata?.credits ?? "0", 10);

      if (!userId || credits <= 0) {
        console.error("Missing or invalid metadata in session:", session.id);
        return new Response(JSON.stringify({ error: "Missing metadata." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use service_role client (bypasses RLS) to atomically increment credits.
      // Calls the system_add_boost_credits RPC (see migration_security_hardening.sql).
      const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: rpcErr } = await adminClient.rpc("system_add_boost_credits", {
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

      console.log(`checkout.session.completed: added ${credits} credits to user ${userId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Interne serverfout." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
