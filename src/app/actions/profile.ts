"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
