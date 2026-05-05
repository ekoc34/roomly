import Link from "next/link";
import { deleteListing } from "@/app/actions/listings";
import { updateApplicationStatus } from "@/app/actions/applications";
import { APPLICATION_STATUS_LABELS, LISTING_TYPE_LABELS } from "@/lib/constants";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, Listing, Profile } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<ApplicationStatus, string> = {
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-stone-100 text-stone-600",
};

type IncomingApp = {
  id: string;
  message: string;
  budget: number | null;
  availability_text: string;
  status: ApplicationStatus;
  created_at: string;
  listing_id: string;
  listings: { title: string } | { title: string }[] | null;
};

type SentApp = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  listings:
    | { title: string; id: string }
    | { title: string; id: string }[]
    | null;
};

function embedOne<T extends { title?: string; id?: string }>(
  x: T | T[] | null | undefined,
): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default async function DashboardPage() {
  if (!getSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-stone-600">
        Supabase is niet geconfigureerd. Voeg je URL en anon key toe in .env.local.
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: myListingsRaw } = await supabase
    .from("listings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const myListings = (myListingsRaw ?? []) as Listing[];
  const listingIds = myListings.map((l) => l.id);

  let incoming: IncomingApp[] = [];
  if (listingIds.length > 0) {
    const { data } = await supabase
      .from("applications")
      .select(
        "id, message, budget, availability_text, status, created_at, listing_id, user_id, listings ( title )",
      )
      .in("listing_id", listingIds)
      .order("created_at", { ascending: false });
    incoming = (data ?? []) as unknown as IncomingApp[];
  }

  const { data: sentRaw } = await supabase
    .from("applications")
    .select("id, status, created_at, listings ( title, id )")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const sent = (sentRaw ?? []) as unknown as SentApp[];

  const reactiesPerListing = incoming.reduce<Record<string, number>>(
    (acc, a) => ({ ...acc, [a.listing_id]: (acc[a.listing_id] ?? 0) + 1 }),
    {},
  );

  // Real metric: messages received on conversations for my listings
  let totalMessagesReceived = 0;
  if (listingIds.length > 0) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .in("listing_id", listingIds);
    const convIds = (convs ?? []).map((c: { id: string }) => c.id);
    if (convIds.length > 0) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", user.id);
      totalMessagesReceived = count ?? 0;
    }
  }

  const isVerified = profile?.email_auto_verified || profile?.student_verified;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8" data-testid="dashboard-page">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Beheer je advertenties, berichten en aanvragen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/profiel"
            className="inline-flex justify-center rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            data-testid="dashboard-edit-profile"
          >
            Profiel bewerken
          </Link>
          <Link
            href="/kamers/nieuw"
            className="inline-flex justify-center rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600"
            data-testid="dashboard-new-listing"
          >
            Nieuwe advertentie
          </Link>
        </div>
      </div>

      <section className="mt-10 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-stone-500">
                {(profile?.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-stone-900">
              {profile?.name ?? "Vul je naam in"}
            </h2>
            <p className="truncate text-sm text-stone-500">{user.email}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isVerified ? (
            <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Geverifieerd
              {profile?.email_auto_verified ? " (universiteits-email)" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
              Nog niet geverifieerd
            </span>
          )}

          {profile?.phone_verified ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Telefoon geverifieerd
            </span>
          ) : null}
        </div>

        {!isVerified && (
          <p className="mt-3 text-xs text-stone-500">
            Tip: registreer met je universiteits-email (.edu, uva.nl, vu.nl, tudelft.nl, ...) en je
            wordt automatisch als student geverifieerd.
          </p>
        )}
      </section>

      <section className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Overzicht</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="flex items-start justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm text-stone-500">Mijn advertenties</p>
              <p className="mt-1 text-3xl font-black text-stone-900" data-testid="stat-listings">
                {myListings.length}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
              <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          </div>
          <div className="flex items-start justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm text-stone-500">Berichten ontvangen</p>
              <p className="mt-1 text-3xl font-black text-stone-900" data-testid="stat-messages">
                {totalMessagesReceived}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
          <div className="flex items-start justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm text-stone-500">Aanvragen verstuurd</p>
              <p className="mt-1 text-3xl font-black text-stone-900" data-testid="stat-sent">
                {sent.length}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Mijn advertenties</h2>
          {myListings.length > 0 && (
            <Link
              href="/kamers/nieuw"
              className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600"
            >
              + Nieuwe advertentie
            </Link>
          )}
        </div>

        {myListings.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
              <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-stone-800">
              Je hebt nog geen advertenties geplaatst
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone-500">
              Plaats je eerste advertentie en bereik direct huurders.
            </p>
            <Link
              href="/kamers/nieuw"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Plaats advertentie
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {myListings.map((l) => {
              const reacties = reactiesPerListing[l.id] ?? 0;
              return (
                <li
                  key={l.id}
                  className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
                  data-testid={`my-listing-${l.id}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 truncate">{l.title}</p>
                      <p className="mt-0.5 text-sm text-stone-500">
                        {LISTING_TYPE_LABELS[l.type]} · {l.location} ·{" "}
                        <span className="font-medium text-stone-800">€{Number(l.price).toFixed(0)}/mnd</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <span className="flex items-center gap-1.5 text-xs text-stone-500">
                          <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span><strong className="text-stone-700">{reacties}</strong> {reacties === 1 ? "reactie" : "reacties"}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Link
                        href={`/kamers/${l.id}`}
                        className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
                      >
                        Bekijken
                      </Link>
                      <form action={deleteListing.bind(null, l.id)}>
                        <button
                          type="submit"
                          className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          data-testid={`delete-listing-${l.id}`}
                        >
                          Verwijderen
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-stone-900">Inkomende aanvragen</h2>
        {incoming.length === 0 ? (
          <div className="mt-4 flex items-start gap-4 rounded-2xl border border-dashed border-stone-200 bg-white px-5 py-6 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700">Nog geen aanvragen ontvangen</p>
              <p className="mt-0.5 text-xs text-stone-500">Zodra iemand reageert op je advertentie, zie je dat hier.</p>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {incoming.map((a) => (
              <li
                key={a.id}
                className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-stone-900">
                  {embedOne(a.listings)?.title ?? "Advertentie"}
                </p>
                <p className="mt-2 text-sm text-stone-600">{a.message}</p>
                <p className="mt-2 text-xs text-stone-500">
                  Budget:{" "}
                  {a.budget != null ? `€${Number(a.budget).toFixed(0)}` : "—"} ·
                  Beschikbaar: {a.availability_text}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[a.status]}`}>
                    {APPLICATION_STATUS_LABELS[a.status]}
                  </span>
                  <span className="text-xs text-stone-400">{new Date(a.created_at).toLocaleDateString("nl-NL")}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={updateApplicationStatus.bind(null, a.id, "accepted")}>
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Accepteren
                    </button>
                  </form>
                  <form action={updateApplicationStatus.bind(null, a.id, "rejected")}>
                    <button
                      type="submit"
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs hover:bg-stone-50"
                    >
                      Afwijzen
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 pb-8">
        <h2 className="text-lg font-semibold text-stone-900">Mijn aanvragen</h2>
        {sent.length === 0 ? (
          <div className="mt-4 flex items-start gap-4 rounded-2xl border border-dashed border-stone-200 bg-white px-5 py-6 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700">Je hebt nog niet gereageerd op een advertentie</p>
              <p className="mt-0.5 text-xs text-stone-500">Bekijk beschikbare woningen en stuur je eerste aanvraag.</p>
              <Link href="/kamers" className="mt-3 inline-block rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">Woningen bekijken →</Link>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {sent.map((s) => {
              const listingEmbed = embedOne(s.listings);
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-1 rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={
                      listingEmbed?.id
                        ? `/kamers/${listingEmbed.id}`
                        : "/kamers"
                    }
                    className="font-medium text-stone-900 hover:text-rose-600"
                  >
                    {listingEmbed?.title ?? "Advertentie"}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[s.status]}`}>
                      {APPLICATION_STATUS_LABELS[s.status]}
                    </span>
                    <span className="text-xs text-stone-400">{new Date(s.created_at).toLocaleDateString("nl-NL")}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
