import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingCard } from "@/components/listings/ListingCard";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function FavorietenPage() {
  if (!getSupabaseConfig()) redirect("/");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/inloggen?next=/favorieten");

  const { data: favRows } = await supabase
    .from("favorites")
    .select("listing_id, created_at, listings(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  type FavRow = {
    listing_id: string;
    created_at: string;
    listings: Listing | Listing[] | null;
  };

  const rows = (favRows ?? []) as unknown as FavRow[];
  const listings: Listing[] = rows
    .map((r) => (Array.isArray(r.listings) ? r.listings[0] : r.listings))
    .filter((l): l is Listing => !!l);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8" data-testid="favorites-page">
      <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
        Mijn favorieten
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Woningen die je hebt opgeslagen om later te bekijken.
      </p>

      {listings.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="mt-4 text-base font-semibold text-stone-800">
            Nog geen favorieten
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
            Tik op het hartje bij een advertentie om deze op te slaan.
          </p>
          <Link
            href="/kamers"
            className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600"
          >
            Bekijk woningen
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} isFavorited={true} />
          ))}
        </div>
      )}
    </div>
  );
}
