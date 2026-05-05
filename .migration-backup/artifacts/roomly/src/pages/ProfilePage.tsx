import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ProfileForm } from "@/components/forms/ProfileForm";
import type { Profile } from "@/types/database";

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/inloggen?next=/profiel"); return; }
    async function load() {
      if (!supabase || !user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile((data ?? null) as Profile | null);
      setLoading(false);
    }
    load();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" /></div>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 pb-28 md:pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Mijn profiel</h1>
        <p className="mt-1 text-sm text-stone-500">Pas jouw zichtbare informatie aan.</p>
      </div>
      <ProfileForm
        userId={user.id}
        userEmail={user.email ?? ""}
        initialName={profile?.name ?? ""}
        initialBio={profile?.bio ?? ""}
        initialPhone={profile?.phone ?? ""}
        initialAvatarUrl={profile?.avatar_url ?? ""}
        initialUserType={profile?.user_type ?? "tenant"}
        isVerified={profile?.email_auto_verified ?? false}
        isPhoneVerified={profile?.phone_verified ?? false}
        onSaved={() => navigate("/dashboard")}
      />
    </div>
  );
}
