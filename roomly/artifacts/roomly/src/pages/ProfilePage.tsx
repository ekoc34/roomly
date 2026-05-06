import { useEffect, useState, useTransition } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import type { Profile } from "@/types/database";

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile | null);
      setLoading(false);
    });
  }, [user, authLoading]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je profiel te bewerken</h1>
        <Link href="/inloggen" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const bio = String(fd.get("bio") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    if (!name) { toast.error("Naam mag niet leeg zijn."); return; }
    startTransition(async () => {
      if (!supabase || !user) { toast.error("Niet ingelogd."); return; }
      const { error: err } = await supabase.from("profiles").upsert({
        id: user.id,
        name,
        bio,
        phone,
        avatar_url: profile?.avatar_url ?? null,
        email: user.email ?? null,
      });
      if (err) { toast.error("Opslaan mislukt. Probeer het opnieuw."); return; }
      setProfile((prev) => prev ? { ...prev, name, bio, phone } : prev);
      toast.success("Profiel opgeslagen!");
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="transition hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Profiel bewerken</span>
      </nav>
      <h1 className="text-2xl font-bold text-stone-900">Mijn profiel</h1>

      <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
        {loading ? (
          <div className="space-y-4">
            <div className="mx-auto h-24 w-24 skeleton rounded-full" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {user && (
              <div className="flex flex-col items-center border-b border-stone-100 pb-6">
                <AvatarUpload
                  userId={user.id}
                  currentUrl={profile?.avatar_url}
                  onUploaded={(url) =>
                    setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev)
                  }
                />
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5" data-testid="profile-form">
              <div>
                <label htmlFor="prof-name" className="text-xs font-medium text-stone-700">Naam *</label>
                <input
                  id="prof-name"
                  name="name"
                  type="text"
                  required
                  defaultValue={profile?.name ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  data-testid="profile-name"
                />
              </div>
              <div>
                <label htmlFor="prof-bio" className="text-xs font-medium text-stone-700">Bio</label>
                <textarea
                  id="prof-bio"
                  name="bio"
                  rows={4}
                  defaultValue={profile?.bio ?? ""}
                  maxLength={500}
                  placeholder="Vertel iets over jezelf…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  data-testid="profile-bio"
                />
              </div>
              <div>
                <label htmlFor="prof-phone" className="text-xs font-medium text-stone-700">Telefoonnummer</label>
                <input
                  id="prof-phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile?.phone ?? ""}
                  placeholder="+31 6 12345678"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  data-testid="profile-phone"
                />
              </div>

              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Verificatiestatus</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${profile?.email_auto_verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500"}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {profile?.email_auto_verified ? "Student e-mail geverifieerd" : "E-mail niet geverifieerd"}
                  </span>
                  <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${profile?.phone_verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500"}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {profile?.phone_verified ? "Telefoon geverifieerd" : "Telefoon niet geverifieerd"}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                data-testid="profile-save"
                className="w-full rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Opslaan…
                  </span>
                ) : "Profiel opslaan"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
