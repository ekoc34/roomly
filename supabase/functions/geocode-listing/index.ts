import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOMINATIM_UA = "Welkthuis/1.0 (info@welkthuis.nl)";
const GEOCODE_TIMEOUT_MS = 6000;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's identity.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Ongeldige sessie." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { listing_id, force = false } = await req.json() as { listing_id: string; force?: boolean };
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "listing_id verplicht." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load the listing — verify ownership at the same time.
    const { data: listing, error: fetchErr } = await adminClient
      .from("listings")
      .select("id, user_id, location, lat, lon")
      .eq("id", listing_id)
      .maybeSingle();

    if (fetchErr || !listing) {
      return new Response(JSON.stringify({ error: "Advertentie niet gevonden." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the owner (or a future admin pathway) may trigger geocoding.
    if (listing.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Geen toegang." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if coordinates are already persisted, unless force=true
    // (used when the listing's location string has changed on edit).
    if (listing.lat != null && listing.lon != null && !force) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Server-side Nominatim geocode ────────────────────────────────────────
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), GEOCODE_TIMEOUT_MS);

    let lat: number | null = null;
    let lon: number | null = null;

    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(listing.location)}` +
        `&countrycodes=nl&format=json&limit=1`;

      const res = await fetch(url, {
        signal: abort.signal,
        headers: {
          "User-Agent": NOMINATIM_UA,
          "Accept-Language": "nl",
          "Accept": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json() as Array<{ lat: string; lon: string }>;
        if (data.length > 0) {
          lat = parseFloat(data[0].lat);
          lon = parseFloat(data[0].lon);
        }
      }
    } catch {
      // Timeout or network error — fail gracefully, coordinates stay NULL.
    } finally {
      clearTimeout(timer);
    }

    if (lat == null || lon == null) {
      // Geocoding failed or returned no result — do not throw.
      return new Response(JSON.stringify({ geocoded: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist coordinates.
    await adminClient
      .from("listings")
      .update({ lat, lon })
      .eq("id", listing_id);

    return new Response(JSON.stringify({ geocoded: true, lat, lon }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Interne serverfout." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
