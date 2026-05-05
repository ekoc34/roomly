import { useEffect } from "react";
import { useLocation } from "wouter";
import { ListingForm } from "@/components/forms/ListingForm";
import { useAuth } from "@/hooks/useAuth";

export function NewListingPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/inloggen?next=/kamers/nieuw");
  }, [user, loading, navigate]);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" /></div>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 pb-28 md:pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Advertentie plaatsen</h1>
        <p className="mt-1 text-sm text-stone-500">Verhuur jouw kamer of appartement gratis op Roomly.</p>
      </div>
      <ListingForm mode="create" />
    </div>
  );
}
