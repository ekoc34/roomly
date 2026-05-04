"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Start or get an existing conversation for this listing between the current user and the landlord.
 * Returns the conversation id.
 */
export async function startConversation(listingId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/inloggen?next=/kamers/${listingId}`);
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.user_id === user.id) return null;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("tenant_id", user.id)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      listing_id: listingId,
      tenant_id: user.id,
      landlord_id: listing.user_id,
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id as string;
}

export async function sendMessage(
  conversationId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Bericht mag niet leeg zijn." };
  if (body.length > 4000) return { error: "Bericht is te lang." };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });
  if (error) return { error: "Versturen mislukt." };

  revalidatePath(`/berichten/${conversationId}`);
  revalidatePath("/berichten");
  return {};
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  revalidatePath("/berichten");
}
