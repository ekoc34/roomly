"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ListingType } from "@/types/database";

function parsePrice(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export async function createListing(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/inloggen");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ListingType;
  const availabilityDate = String(formData.get("availability_date") ?? "").trim();
  const imagesJson = String(formData.get("images_json") ?? "[]");

  let images: string[] = [];
  try {
    const parsed = JSON.parse(imagesJson) as unknown;
    if (Array.isArray(parsed)) {
      images = parsed.filter((u) => typeof u === "string");
    }
  } catch {
    images = [];
  }

  const price = parsePrice(priceRaw);
  const validTypes: ListingType[] = [
    "room_for_rent",
    "roommate_search",
    "short_stay",
  ];

  if (!title) return { error: "Vul een titel in." };
  if (!description) return { error: "Vul een beschrijving in." };
  if (price === null) return { error: "Vul een geldige prijs in (groter dan 0)." };
  if (!location) return { error: "Kies een locatie." };
  if (!validTypes.includes(type)) return { error: "Kies een geldig type advertentie." };

  const { error: insertError } = await supabase.from("listings").insert({
    user_id: user.id,
    title,
    description,
    price,
    location,
    type,
    images,
    availability_date: availabilityDate || null,
  });

  if (insertError) {
    console.error("[createListing] Supabase insert error:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      user_id: user.id,
    });
    return {
      error: `Er ging iets mis bij het plaatsen van je advertentie. Controleer je gegevens en probeer opnieuw. (code: ${insertError.code ?? "unknown"})`,
    };
  }

  revalidatePath("/kamers");
  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateListing(listingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/inloggen");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ListingType;
  const availabilityDate = String(formData.get("availability_date") ?? "").trim();
  const imagesJson = String(formData.get("images_json") ?? "[]");

  let images: string[] = [];
  try {
    const parsed = JSON.parse(imagesJson) as unknown;
    if (Array.isArray(parsed)) {
      images = parsed.filter((u) => typeof u === "string");
    }
  } catch {
    images = [];
  }

  const price = parsePrice(priceRaw);
  const validTypes: ListingType[] = [
    "room_for_rent",
    "roommate_search",
    "short_stay",
  ];

  if (
    !title ||
    !description ||
    price === null ||
    !location ||
    !validTypes.includes(type)
  ) {
    return { error: "Vul alle verplichte velden correct in." };
  }

  const { error } = await supabase
    .from("listings")
    .update({
      title,
      description,
      price,
      location,
      type,
      images,
      availability_date: availabilityDate || null,
    })
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[updateListing] Supabase update error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      listingId,
      user_id: user.id,
    });
    return {
      error: `Er ging iets mis bij het bijwerken van je advertentie. (code: ${error.code ?? "unknown"})`,
    };
  }

  revalidatePath("/kamers");
  revalidatePath(`/kamers/${listingId}`);
  revalidatePath("/dashboard");
  redirect(`/kamers/${listingId}`);
}

export async function deleteListing(
  listingId: string,
  _formData?: FormData,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/inloggen");
  }

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (error) {
    return;
  }

  revalidatePath("/kamers");
  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
