import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Listing } from "@/types/database";

function sanitizeSearch(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 100);
}

export async function fetchListings(params: {
  q?: string;
  min?: string;
  max?: string;
  district?: string;
  type?: string;
  sort?: string;
}): Promise<Listing[]> {
  if (!getSupabaseConfig()) return [];

  const supabase = await createClient();
  let q = supabase.from("listings").select("*");

  const minN = params.min ? Number.parseFloat(params.min) : NaN;
  const maxN = params.max ? Number.parseFloat(params.max) : NaN;
  if (!Number.isNaN(minN) && minN >= 0) {
    q = q.gte("price", minN);
  }
  if (!Number.isNaN(maxN) && maxN >= 0) {
    q = q.lte("price", maxN);
  }
  if (params.district) {
    q = q.eq("location", params.district);
  }
  if (
    params.type &&
    ["room_for_rent", "roommate_search", "short_stay"].includes(params.type)
  ) {
    q = q.eq("type", params.type);
  }
  const s = params.q ? sanitizeSearch(params.q) : "";
  if (s) {
    const pattern = `%${s}%`;
    q = q.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  const cheapest = params.sort === "cheapest";
  const { data, error } = await q.order(
    cheapest ? "price" : "created_at",
    { ascending: cheapest },
  );

  if (error || !data) return [];
  return data as Listing[];
}

export async function fetchFeaturedListings(limit = 6): Promise<Listing[]> {
  if (!getSupabaseConfig()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Listing[];
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  if (!getSupabaseConfig()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Listing;
}
