import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProfielPage() {
  if (!getSupabaseConfig()) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/inloggen?next=/profiel");

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6" data-testid="profile-page">
      <Link href="/dashboard" className="text-sm font-medium text-rose-600 hover:underline">
        ← Terug naar dashboard
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
          Mijn profiel
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Vul je profiel in zodat huurders en verhuurders je beter leren kennen.
          Een compleet profiel verhoogt het vertrouwen.
        </p>
      </div>

      <div className="mt-8">
        <ProfileForm
          userEmail={user.email ?? ""}
          initialName={profile?.name ?? ""}
          initialBio={profile?.bio ?? ""}
          initialPhone={profile?.phone ?? ""}
          initialAvatarUrl={profile?.avatar_url ?? ""}
          initialUserType={profile?.user_type ?? "tenant"}
          isVerified={Boolean(profile?.email_auto_verified || profile?.student_verified)}
          isPhoneVerified={Boolean(profile?.phone_verified)}
        />
      </div>
    </div>
  );
}
