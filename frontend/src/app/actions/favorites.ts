"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function toggleFavorite(listingId: string): Promise<{ favorited: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: existing } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);
    revalidatePath("/favorieten");
    revalidatePath(`/kamers/${listingId}`);
    return { favorited: false };
  }

  const { error } = await supabase.from("favorites").insert({
    user_id: user.id,
    listing_id: listingId,
  });
  if (error) return { error: "Opslaan mislukt." };

  revalidatePath("/favorieten");
  revalidatePath(`/kamers/${listingId}`);
  return { favorited: true };
}
