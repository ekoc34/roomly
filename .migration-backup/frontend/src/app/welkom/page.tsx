import { redirect } from "next/navigation";
import { UserPersonaSelector } from "@/components/onboarding/UserPersonaSelector";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function WelkomPage() {
  if (!getSupabaseConfig()) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/inloggen?next=/welkom");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      <UserPersonaSelector />
    </div>
  );
}
