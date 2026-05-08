import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ListingCard } from "@/components/listings/ListingCard";
import { LazyImage } from "@/components/ui/lazy-image";
import type { Listing, Profile } from "@/types/database";

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }
    async function fetchData() {
      const [{ data: p }, { data: ls }] = await Promise.all([
        supabase!.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase!.from("listings").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      ]);
      setProfile(p as Profile | null);
      setMyListings((ls as Listing[] | null) ?? []);
      setLoading(false);
    }
    fetchData();
  }, [user, authLoading]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je dashboard te bekijken</h1>
        <Link href="/inloggen" data-testid="dashboard-login-link" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  const initial = (profile?.name ?? profile?.email ?? user?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <>
      <Helmet>
        <title>Dashboard — Roomly</title>
        <meta name="description" content="Beheer je profiel, woningen en berichten." />
      </Helmet>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 shadow-sm">
            {profile?.avatar_url ? (
              <LazyImage src={profile.avatar_url} alt="" formatWebp />
            ) : (
              <span className="text-xl font-bold text-stone-500">{initial}</span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">{loading ? "Laden…" : (profile?.name ?? profile?.email ?? user?.email ?? "Gebruiker")}</h1>
            <p className="text-sm text-stone-500">{user?.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/profiel" className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" data-testid="dashboard-edit-profile">
            Profiel bewerken
          </Link>
          <Link href="/kamers/nieuw" className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95" data-testid="dashboard-new-listing">
            + Advertentie plaatsen
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Mijn advertenties", value: myListings.length, href: "#listings", color: "rose" },
          { label: "Berichten", value: "→", href: "/berichten", color: "blue" },
          { label: "Favorieten", value: "→", href: "/favorieten", color: "stone" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="flex flex-col gap-2 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-medium text-stone-500">{stat.label}</p>
            <p className="text-2xl font-black text-stone-900">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div id="listings" className="mt-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-stone-900">Mijn advertenties</h2>
          <Link href="/kamers/nieuw" className="text-sm font-medium text-rose-600 hover:underline">+ Nieuwe advertentie</Link>
        </div>
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((n) => (
              <div key={n} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
                <div className="aspect-[4/3] animate-pulse bg-stone-200" />
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-stone-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-stone-200" />
                  <div className="mt-auto h-5 w-1/3 animate-pulse rounded-full bg-stone-200" />
                </div>
              </div>
            ))}
          </div>
        ) : myListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
              <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-stone-800">Nog geen advertenties</h3>
            <p className="mt-2 max-w-sm text-sm text-stone-500">Plaats je eerste advertentie en bereik duizenden huurders.</p>
            <Link href="/kamers/nieuw" className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Advertentie plaatsen</Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {myListings.map((l) => (
              <ListingCard key={l.id} listing={l} isFavorited={false} />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
