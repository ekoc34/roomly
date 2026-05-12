import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Stripe } from "https://esm.sh/stripe@13.3.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const PACKAGES = {
  starter:   { credits: 1,  priceId: "price_1TWHo0ECUpERwjgz7bqjP5Lq" },
  populair:  { credits: 5,  priceId: "price_1TWHpDECUpERwjgzViavok6r" },
  pro:       { credits: 15, priceId: "price_1TWHpuECUpERwjgzM5xNTTLv" },
  max:       { credits: 50, priceId: "price_1TWHqZECUpERwjgzmEsKOOPZ" },
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["ideal"],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/betaling-succesvol`,
      cancel_url: `${req.headers.get("origin")}/pricing`,
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
    console.error("Stripe session error:", err);
    return new Response(JSON.stringify({ error: "Betaling kon niet worden gestart" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
