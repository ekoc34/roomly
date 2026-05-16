import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Extract the storage object path from a Supabase public URL. */
function extractPath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx !== -1 ? decodeURIComponent(url.slice(idx + marker.length)) : null;
}

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

    // Verify the caller's JWT to get their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Ongeldige sessie." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();

    // Security: a user may only delete their own auth record
    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: "Geen toegang." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // S-01/S-02: Collect all storage objects belonging to this user before
    // deleting the auth record (which cascades and removes DB rows).
    const storagePaths: { bucket: string; paths: string[] }[] = [];

    // 1. Listing images
    const { data: listings } = await adminClient
      .from("listings")
      .select("images")
      .eq("user_id", userId);

    const listingPaths: string[] = [];
    for (const listing of listings ?? []) {
      for (const url of (listing.images ?? []) as string[]) {
        const p = extractPath(url, "listings");
        if (p) listingPaths.push(p);
      }
    }
    if (listingPaths.length > 0) {
      storagePaths.push({ bucket: "listings", paths: listingPaths });
    }

    // 2. Avatar
    const { data: profile } = await adminClient
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.avatar_url) {
      const avatarPath = extractPath(profile.avatar_url, "avatars");
      if (avatarPath) {
        storagePaths.push({ bucket: "avatars", paths: [avatarPath] });
      }
    }

    // Delete storage files (best-effort — don't fail the account deletion if this errors).
    await Promise.allSettled(
      storagePaths.map(({ bucket, paths }) =>
        adminClient.storage.from(bucket).remove(paths)
      )
    );

    // Use service role client to permanently remove the auth.users record
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      // Treat "not found" as success — the record may have already been removed
      if (deleteError.message.toLowerCase().includes("not found")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
