import Link from "next/link";
import { deleteListing } from "@/app/actions/listings";
import { requestStudentVerification } from "@/app/actions/profile";
import { updateApplicationStatus } from "@/app/actions/applications";
import { APPLICATION_STATUS_LABELS, LISTING_TYPE_LABELS } from "@/lib/constants";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, Listing } from "@/types/database";

export const dynamic = "force-dynamic";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Beheer je advertenties en aanvragen.
          </p>
        </div>
        <Link
          href="/kamers/nieuw"
          className="inline-flex justify-center rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600"
        >
          Nieuwe advertentie
        </Link>
      </div>

      <section className="mt-10 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">Je profiel</h2>
        <p className="mt-1 text-sm text-stone-500">{user.email}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-600">
          <span>
            Student geverifieerd:{" "}
            <strong>{profile?.student_verified ? "ja" : "nee"}</strong>
          </span>
          {profile?.student_verification_requested_at ? (
            <span className="text-stone-400">
              Verificatie aangevraagd op{" "}
              {new Date(profile.student_verification_requested_at).toLocaleDateString(
                "nl-NL",
              )}
            </span>
          ) : null}
        </div>
        {!profile?.student_verified ? (
          <div className="mt-4">
            <form action={requestStudentVerification}>
              <button
                type="submit"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:border-rose-200 hover:bg-rose-50"
              >
                Vraag studentverificatie aan
              </button>
            </form>
            <p className="mt-2 text-xs text-stone-500">
              Optioneel: laat zien dat je student bent. We beoordelen verzoeken handmatig
              (MVP).
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-stone-900">Statistieken</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Advertenties</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">
              {myListings.length}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Inkomende aanvragen</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">
              {incoming.length}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Jouw aanvragen</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">
              {sent.length}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-stone-900">Mijn advertenties</h2>
        {myListings.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            Je hebt nog geen advertenties.{" "}
            <Link href="/kamers/nieuw" className="text-rose-600 hover:underline">
              Plaats er een
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {myListings.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-stone-900">{l.title}</p>
                  <p className="text-sm text-stone-500">
                    {LISTING_TYPE_LABELS[l.type]} · {l.location} · €
                    {Number(l.price).toFixed(0)}/mnd
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/kamers/${l.id}`}
                    className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm hover:bg-stone-50"
                  >
                    Bekijken
                  </Link>
                  <Link
                    href={`/kamers/${l.id}/bewerken`}
                    className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm hover:bg-stone-50"
                  >
                    Bewerken
                  </Link>
                  <form action={deleteListing.bind(null, l.id)}>
                    <button
                      type="submit"
                      className="rounded-xl border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                    >
                      Verwijderen
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-stone-900">
          Inkomende aanvragen
        </h2>
        {incoming.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            Nog geen aanvragen op je advertenties.
          </p>
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
                <p className="mt-1 text-xs text-stone-400">
                  {APPLICATION_STATUS_LABELS[a.status]} ·{" "}
                  {new Date(a.created_at).toLocaleString("nl-NL")}
                </p>
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
        <h2 className="text-lg font-semibold text-stone-900">Jouw aanvragen</h2>
        {sent.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            Je hebt nog niet op advertenties gereageerd.
          </p>
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
                  <span className="text-stone-500">
                    {APPLICATION_STATUS_LABELS[s.status]} ·{" "}
                    {new Date(s.created_at).toLocaleDateString("nl-NL")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
