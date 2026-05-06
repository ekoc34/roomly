import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ListingForm } from "@/components/forms/ListingForm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Listing } from "@/types/database";

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [listing, setListing] = useState<Listing | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/inloggen"); return; }
    if (!id || !supabase) { setPageLoading(false); return; }
    supabase.from("listings").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) { setForbidden(true); setPageLoading(false); return; }
      if (data.user_id !== user.id) { setForbidden(true); setPageLoading(false); return; }
      setListing(data as Listing);
      setPageLoading(false);
    });
  }, [id, user, authLoading, navigate]);

  if (authLoading || pageLoading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" /></div>;
  if (forbidden) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="text-xl font-semibold text-stone-900">Geen toegang</h1><p className="mt-2 text-sm text-stone-500">Je kunt alleen je eigen advertenties bewerken.</p></div>;
  if (!listing) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 pb-28 md:pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Advertentie bewerken</h1>
        <p className="mt-1 text-sm text-stone-500">Werk je advertentie bij en sla de wijzigingen op.</p>
      </div>
      <ListingForm mode="edit" listing={listing} />
    </div>
  );
}
