import { useEffect, useState, useTransition } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/types/database";

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const bio = String(fd.get("bio") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const avatar_url = String(fd.get("avatar_url") ?? "").trim();
    if (!name) { setError("Naam mag niet leeg zijn."); return; }
    startTransition(async () => {
      if (!supabase || !user) { setError("Niet ingelogd."); return; }
      const { error: err } = await supabase.from("profiles").upsert({ id: user.id, name, bio, phone, avatar_url, email: user.email ?? null });
      if (err) { setError("Opslaan mislukt."); return; }
      setProfile((prev) => prev ? { ...prev, name, bio, phone, avatar_url } : prev);
      setSuccess(true);
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Profiel bewerken</span>
      </nav>
      <h1 className="text-2xl font-bold text-stone-900">Mijn profiel</h1>
      <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded-xl bg-stone-200" />
            ))}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5" data-testid="profile-form">
            <div>
              <label htmlFor="prof-name" className="text-xs font-medium text-stone-700">Naam *</label>
              <input id="prof-name" name="name" type="text" required defaultValue={profile?.name ?? ""} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-name" />
            </div>
            <div>
              <label htmlFor="prof-bio" className="text-xs font-medium text-stone-700">Bio</label>
              <textarea id="prof-bio" name="bio" rows={4} defaultValue={profile?.bio ?? ""} maxLength={500} placeholder="Vertel iets over jezelf…" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-bio" />
            </div>
            <div>
              <label htmlFor="prof-phone" className="text-xs font-medium text-stone-700">Telefoonnummer</label>
              <input id="prof-phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} placeholder="+31 6 12345678" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-phone" />
            </div>
            <div>
              <label htmlFor="prof-avatar" className="text-xs font-medium text-stone-700">Profielfoto URL</label>
              <input id="prof-avatar" name="avatar_url" type="url" defaultValue={profile?.avatar_url ?? ""} placeholder="https://..." className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-avatar" />
            </div>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">Profiel opgeslagen!</p>}
            <button type="submit" disabled={isPending} data-testid="profile-save" className="rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]">
              {isPending ? "Opslaan…" : "Profiel opslaan"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
