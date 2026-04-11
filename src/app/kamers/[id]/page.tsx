import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/forms/ApplicationForm";
import { DetailGallery } from "@/components/listings/DetailGallery";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import { fetchListingById } from "@/lib/data/listings";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!getSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-stone-600">
        Supabase is niet geconfigureerd.
      </div>
    );
  }

  const listing = await fetchListingById(id);
  if (!listing) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === listing.user_id;
  const canApply = Boolean(user) && !isOwner;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/kamers"
        className="text-sm font-medium text-rose-600 hover:underline"
      >
        Terug naar overzicht
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <DetailGallery images={listing.images} title={listing.title} />
        </div>
        <div>
          <p className="text-sm font-medium text-rose-600">
            {LISTING_TYPE_LABELS[listing.type]}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900 sm:text-3xl">
            {listing.title}
          </h1>
          <p className="mt-2 text-stone-500">{listing.location}</p>
          <p className="mt-4 text-3xl font-semibold text-stone-900">
            €{Number(listing.price).toFixed(0)}
            <span className="text-base font-normal text-stone-500"> / maand</span>
          </p>
          {listing.availability_date ? (
            <p className="mt-2 text-sm text-stone-600">
              Beschikbaar per{" "}
              {new Date(listing.availability_date).toLocaleDateString("nl-NL")}
            </p>
          ) : null}

          <div className="mt-8 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-stone-900">Beschrijving</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
              {listing.description}
            </p>
          </div>

          <div className="mt-8 space-y-4" id="reageer">
            {isOwner ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                Dit is jouw advertentie. Beheer aanvragen in je{" "}
                <Link href="/dashboard" className="font-medium text-rose-600 hover:underline">
                  dashboard
                </Link>
                .
              </div>
            ) : null}
            {!user ? (
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-700 shadow-sm">
                <p>Log in om te reageren op deze advertentie.</p>
                <Link
                  href={`/inloggen?next=/kamers/${listing.id}`}
                  className="mt-3 inline-flex rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                >
                  Inloggen en reageren
                </Link>
              </div>
            ) : null}
            {canApply ? <ApplicationForm listingId={listing.id} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
