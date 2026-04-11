"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/types/database";

function parseBudget(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function createApplication(listingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/inloggen");
  }

  const message = String(formData.get("message") ?? "").trim();
  const budget = parseBudget(String(formData.get("budget") ?? ""));
  const availabilityText = String(formData.get("availability_text") ?? "").trim();

  if (!message || !availabilityText) {
    return { error: "Bericht en beschikbaarheid zijn verplicht." };
  }

  const { error } = await supabase.from("applications").insert({
    listing_id: listingId,
    user_id: user.id,
    message,
    budget,
    availability_text: availabilityText,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Je hebt al een aanvraag ingediend voor deze advertentie." };
    }
    return { error: "Aanvraag kon niet worden verstuurd." };
  }

  revalidatePath(`/kamers/${listingId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  _formData?: FormData,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/inloggen");
  }

  const valid: ApplicationStatus[] = ["pending", "accepted", "rejected"];
  if (!valid.includes(status)) {
    return;
  }

  const { data: app, error: fetchErr } = await supabase
    .from("applications")
    .select("id, listing_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (fetchErr || !app) {
    return;
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("user_id")
    .eq("id", app.listing_id)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return;
  }

  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId);

  if (error) {
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/kamers/${app.listing_id}`);
}
