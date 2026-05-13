import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Stripe } from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const PACKAGES = {
  starter:   { credits: 1,  priceId: "price_1TWeW3ECUpERwjgzVWwCGd16" },
  populair:  { credits: 5,  priceId: "price_1TWeWUECUpERwjgzy6raYM3N" },
  pro:       { credits: 15, priceId: "price_1TWeX7ECUpERwjgzdMLzvWo5" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { packageId, userEmail } = body;
  const pkg = PACKAGES[packageId as keyof typeof PACKAGES];
  if (!pkg) {
    return new Response(JSON.stringify({ error: "Ongeldig pakket" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const token = authHeader.split("Bearer ")[1];
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    const userId = user?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Kan gebruiker niet verifiëren" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use the request origin if present; fall back to the configured FRONTEND_URL.
    // Never let this be null — Stripe rejects malformed success/cancel URLs.
    const origin =
      req.headers.get("origin") ??
      Deno.env.get("FRONTEND_URL") ??
      "https://welkthuis.nl";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["ideal"],
      mode: "payment",
      success_url: `${origin}/betaling-succesvol`,
      cancel_url: `${origin}/pricing`,
      customer_email: userEmail,
      metadata: {
        user_id: userId,
        package_id: packageId,
        credits: pkg.credits.toString(),
      },
      line_items: [{ price: pkg.priceId, quantity: 1 }],
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    // Log the full Stripe error so it appears in Edge Function invocation logs.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe session error:", message, err);
    return new Response(
      JSON.stringify({ error: "Betaling kon niet worden gestart", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
