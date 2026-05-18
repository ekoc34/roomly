import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Sprout, Trash2, RefreshCw, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AdminSeedTab() {
  const [isPending, startTransition] = useTransition();
  const [demoCount, setDemoCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);

  async function loadCount() {
    if (!supabase) return;
    setCountLoading(true);
    const { data, error } = await supabase.rpc("admin_demo_listing_count");
    if (!error && typeof data === "number") setDemoCount(data);
    setCountLoading(false);
  }

  useEffect(() => { loadCount(); }, []);

  const handleSeed = () => {
    if (!supabase) return;
    startTransition(async () => {
      const { data, error } = await supabase!.rpc("admin_seed_demo_listings");
      if (error) {
        toast.error("Seeden mislukt: " + error.message);
        return;
      }
      if (data === 0) {
        toast.info("Demo-advertenties bestaan al — geen duplicaten aangemaakt.");
      } else {
        toast.success(`${data} demo-advertenties aangemaakt.`);
      }
      await loadCount();
    });
  };

  const handleDelete = () => {
    if (!supabase) return;
    if (!confirm("Weet je zeker dat je alle demo-advertenties wilt verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    startTransition(async () => {
      const { data, error } = await supabase!.rpc("admin_delete_demo_listings");
      if (error) {
        toast.error("Verwijderen mislukt: " + error.message);
        return;
      }
      toast.success(`${data ?? 0} demo-advertenties verwijderd.`);
      await loadCount();
    });
  };

  const isSeeded = (demoCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="space-y-1">
          <p className="font-semibold">Demo-ecosysteem</p>
          <p className="leading-relaxed">
            Genereer 35 realistische voorbeeldwoningen verspreid over Amsterdam, Utrecht, Rotterdam en Eindhoven.
            Alle demo-advertenties krijgen een zichtbare <strong>Voorbeeldwoning</strong>-badge en zijn duidelijk gemarkeerd
            als demo-inhoud. Ze worden nooit gekoppeld aan echte verhuurders of gebruikers.
          </p>
          <p className="leading-relaxed">
            De functie is <strong>idempotent</strong>: opnieuw uitvoeren wanneer er al demo-advertenties zijn heeft geen effect.
            Gebruik verwijderen om opnieuw te beginnen.
          </p>
        </div>
      </div>

      {/* Status card */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isSeeded ? "bg-emerald-100" : "bg-stone-100"}`}>
              <Sprout className={`h-6 w-6 ${isSeeded ? "text-emerald-600" : "text-stone-400"}`} />
            </span>
            <div>
              <p className="text-lg font-bold text-stone-900">
                {countLoading ? (
                  <span className="inline-block h-5 w-16 animate-pulse rounded bg-stone-200" />
                ) : (
                  <>{demoCount ?? 0} demo-advertenties</>
                )}
              </p>
              <p className="text-sm text-stone-500">
                {isSeeded ? "Platform is gevuld met voorbeeldinhoud" : "Nog geen demo-inhoud aanwezig"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadCount}
            disabled={isPending || countLoading}
            title="Vernieuwen"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 text-stone-400 transition hover:border-stone-300 hover:text-stone-600 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${countLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Breakdown (when seeded) */}
      {isSeeded && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { city: "Amsterdam", count: 12, color: "bg-rose-50 border-rose-200 text-rose-700" },
            { city: "Utrecht",   count: 8,  color: "bg-amber-50 border-amber-200 text-amber-700" },
            { city: "Rotterdam", count: 8,  color: "bg-blue-50 border-blue-200 text-blue-700" },
            { city: "Eindhoven", count: 7,  color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          ].map(({ city, count, color }) => (
            <div key={city} className={`rounded-2xl border px-4 py-3 ${color}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs font-medium">{city}</p>
            </div>
          ))}
        </div>
      )}

      {/* Listing types when seeded */}
      {isSeeded && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-stone-700">Diversiteit per type</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-stone-600">
            {[
              ["Studentenkamers", "9×"],
              ["Studio's", "8×"],
              ["Expat appartementen", "5×"],
              ["Gedeeld (huisgenoot)", "7×"],
              ["Budgetkamers", "4×"],
              ["Luxe appartementen", "5×"],
              ["Kort verblijf (short-stay)", "3×"],
            ].map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <span>{label}</span>
                <span className="font-semibold text-stone-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSeed}
          disabled={isPending || isSeeded}
          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 active:scale-95"
        >
          <Sprout className="h-4 w-4" />
          {isPending ? "Bezig…" : "Genereer demo-advertenties"}
        </button>

        {isSeeded && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            Verwijder alle demo-advertenties
          </button>
        )}
      </div>

      {/* Safety note */}
      <div className="rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4 text-xs leading-relaxed text-stone-500">
        <strong className="font-semibold text-stone-600">Veiligheid &amp; transparantie:</strong>{" "}
        Demo-advertenties zijn altijd zichtbaar gelabeld als &ldquo;Voorbeeldwoning&rdquo; voor alle bezoekers.
        Ze zijn gekoppeld aan jouw admin-account als eigenaar en bevatten geen nep-gebruikers, geen nep-berichten
        en geen misleidende contactgegevens. Verwijderen cascade-verwijdert ook eventuele favorieten die aan
        demo-advertenties zijn gekoppeld.
      </div>
    </div>
  );
}
