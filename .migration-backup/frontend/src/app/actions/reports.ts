"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReportCategory } from "@/types/database";

const CATEGORIES: ReportCategory[] = [
  "scam",
  "spam",
  "inappropriate",
  "fake_photos",
  "duplicate",
  "other",
];

export async function reportListing(
  listingId: string,
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log eerst in om een advertentie te melden." };

  const category = String(formData.get("category") ?? "other") as ReportCategory;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!CATEGORIES.includes(category)) return { error: "Ongeldige categorie." };
  if (!reason) return { error: "Beschrijf kort waarom je deze advertentie meldt." };
  if (reason.length > 1000) return { error: "Toelichting is te lang." };

  const { error } = await supabase.from("listing_reports").insert({
    listing_id: listingId,
    reporter_id: user.id,
    reason,
    category,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Je hebt deze advertentie al gemeld." };
    }
    return { error: "Melden mislukt. Probeer opnieuw." };
  }

  revalidatePath(`/kamers/${listingId}`);
  return { success: true };
}
