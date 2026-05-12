// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout Session (TEST MODE) with iDEAL support.
//
// ── DEPLOYMENT INSTRUCTIONS ────────────────────────────────────────────────
// 1. Install Supabase CLI:  npm install -g supabase
// 2. Login:                 supabase login
// 3. Link project:          supabase link --project-ref YOUR_PROJECT_REF
// 4. Deploy:                supabase functions deploy stripe-checkout
//
// ── REQUIRED SECRETS (set via Supabase Dashboard › Settings › Edge Functions) ─
//    STRIPE_SECRET_KEY   →  sk_test_YOUR_STRIPE_SECRET_KEY
//    APP_URL             →  https://your-app-url (no trailing slash)
// ──────────────────────────────────────────────────────────────────────────

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACKAGES = {
  starter:  { credits: 1,  amountCents: 199,  label: "Starter"  },
  populair: { credits: 5,  amountCents: 799,  label: "Populair" },
  pro:      { credits: 15, amountCents: 1999, label: "Pro"      },
  max:      { credits: 50, amountCents: 4999, label: "Max"      },
} as const;

type PackageId = keyof typeof PACKAGES;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!;
    const stripeKey    = Deno.env.get("STRIPE_SECRET_KEY")!;
    const appUrl       = Deno.env.get("APP_URL") ?? "http://localhost:5000";

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Ongeldige sessie." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin-only gate
    const { data: profile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if ((profile as { role: string } | null)?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Alleen admins kunnen betalingen testen." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate package
    const { packageId } = await req.json() as { packageId: string };
    if (!packageId || !(packageId in PACKAGES)) {
      return new Response(JSON.stringify({ error: "Ongeldig pakket." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pkg = PACKAGES[packageId as PackageId];
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Create Stripe Checkout Session in TEST MODE with iDEAL
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["ideal"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: pkg.amountCents,
            product_data: {
              name: `Boost Credits — ${pkg.label}`,
              description: `${pkg.credits} Boost Credit${pkg.credits > 1 ? "s" : ""} voor Welkthuis.nl`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/betaling-succesvol?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/pricing`,
      metadata: {
        user_id:    user.id,
        package_id: packageId,
        credits:    String(pkg.credits),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-checkout error:", err);
    return new Response(JSON.stringify({ error: "Interne serverfout." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
