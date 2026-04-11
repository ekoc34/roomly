import { ListingForm } from "@/components/forms/ListingForm";

export const metadata = { title: "Nieuwe advertentie" };

export default function NieuweAdvertentiePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
        Nieuwe advertentie
      </h1>
      <p className="mt-2 max-w-xl text-sm text-stone-500">
        Plaats een kamer, een mede-huurderzoek of een kort verblijf.
      </p>
      <div className="mt-8">
        <ListingForm mode="create" />
      </div>
    </div>
  );
}
