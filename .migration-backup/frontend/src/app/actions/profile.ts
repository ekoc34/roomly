"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserType } from "@/types/database";

const USER_TYPES: UserType[] = [
  "tenant",
  "landlord",
  "student",
  "professional",
  "family",
];

export async function requestStudentVerification(
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
    .from("profiles")
    .update({ student_verification_requested_at: new Date().toISOString() })
    .eq("id", user.id);

  if (!error) {
    revalidatePath("/dashboard");
  }
}

export async function updateProfile(formData: FormData): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inloggen");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 500);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();
  const userType = String(formData.get("user_type") ?? "tenant") as UserType;

  if (!USER_TYPES.includes(userType)) {
    return { error: "Ongeldig profieltype." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name: name || null,
      bio: bio || null,
      phone: phone || null,
      avatar_url: avatarUrl || null,
      user_type: userType,
    })
    .eq("id", user.id);

  if (error) return { error: "Profiel opslaan mislukt." };

  revalidatePath("/dashboard");
  revalidatePath("/profiel");
  return { success: true };
}

export async function setUserType(userType: UserType): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!USER_TYPES.includes(userType)) return { error: "Invalid type" };

  const { error } = await supabase
    .from("profiles")
    .update({ user_type: userType })
    .eq("id", user.id);

  if (error) return { error: "Opslaan mislukt" };
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { success: true };
}
