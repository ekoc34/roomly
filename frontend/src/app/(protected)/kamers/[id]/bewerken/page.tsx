import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/forms/ListingForm";
import { fetchListingById } from "@/lib/data/listings";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await fetchListingById(id);
  return {
    title: listing ? `Bewerken: ${listing.title}` : "Advertentie bewerken",
  };
}

export default async function BewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!getSupabaseConfig()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inloggen");

  const listing = await fetchListingById(id);
  if (!listing || listing.user_id !== user.id) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
        Advertentie bewerken
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Wijzig de gegevens van je advertentie. Opgeslagen wijzigingen zijn direct
        zichtbaar.
      </p>
      <div className="mt-8">
        <ListingForm mode="edit" listing={listing} />
      </div>
    </div>
  );
}
