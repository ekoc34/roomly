import { useState } from "react";
import { Link } from "wouter";
import { Elements } from "@stripe/react-stripe-js";
import { Zap, Star, Rocket, Info } from "lucide-react";
import { toast } from "sonner";
import { stripePromise } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const PACKAGES = [
  {
    id: "starter",
    name: "Starter",
    credits: 1,
    price: 1.99,
    description: "Probeer het uit",
    Icon: Zap,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-50",
    popular: false,
  },
  {
    id: "populair",
    name: "Populair",
    credits: 5,
    price: 7.99,
    description: "Meest gekozen",
    Icon: Star,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-50",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    credits: 15,
    price: 19.99,
    description: "Serieuze verhuurder",
    Icon: Rocket,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
    popular: false,
  },
] as const;

type PackageId = (typeof PACKAGES)[number]["id"];

function formatPrice(price: number) {
  return `€${price.toFixed(2).replace(".", ",")}`;
}

function PricingContent() {
  const { user, loading: authLoading } = useAuth();
  const [loadingId, setLoadingId] = useState<PackageId | null>(null);

  const handleBuy = async (packageId: PackageId) => {
    if (!supabase || !user) return;
    setLoadingId(packageId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ packageId }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.url) {
        toast.error(json.error ?? "Kon betaling niet starten. Probeer opnieuw.");
        return;
      }
      window.location.href = json.url;
    } catch {
      toast.error("Er is een fout opgetreden. Probeer opnieuw.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <nav className="mb-8 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Boost Credits</span>
      </nav>

      <div className="mb-12 text-center">
        <h1 className="text-3xl font-black text-stone-900">Boost Credits kopen</h1>
        <p className="mt-3 mx-auto max-w-md text-sm text-stone-500">
          Licht je advertentie uit en bereik meer huurders. Betaal snel en veilig via iDEAL.
        </p>
      </div>

      <div className="flex justify-center"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PACKAGES.map((pkg) => {
          const { Icon } = pkg;
          const isLoading = loadingId === pkg.id;
          const anyLoading = loadingId !== null;

          return (
            <div
              key={pkg.id}
              className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition ${
                pkg.popular
                  ? "border-rose-300 ring-2 ring-rose-200"
                  : "border-stone-200"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                  Meest gekozen
                </span>
              )}

              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${pkg.iconBg}`}>
                <Icon className={`h-6 w-6 ${pkg.iconColor}`} />
              </div>

              <p className="text-xs font-medium text-stone-500">{pkg.description}</p>
              <h2 className="mt-1 text-xl font-black text-stone-900">{pkg.name}</h2>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-black text-stone-900">{formatPrice(pkg.price)}</span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                {pkg.credits === 1 ? "1 Boost Credit" : `${pkg.credits} Boost Credits`}
              </p>
              <p className="mt-0.5 text-xs text-stone-400">
                {formatPrice(pkg.price / pkg.credits)} per credit
              </p>

              <div className="mt-auto pt-6">
                {authLoading ? (
                  <div className="h-10 w-full animate-pulse rounded-2xl bg-stone-100" />
                ) : user ? (
                  <button
                    onClick={() => handleBuy(pkg.id)}
                    disabled={isLoading || anyLoading}
                    className="w-full rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? "Laden…" : "Koop nu"}
                  </button>
                ) : (
                  <Link
                    href="/inloggen?next=/pricing"
                    className="block w-full rounded-2xl bg-rose-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
                  >
                    Inloggen om te kopen
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div></div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-stone-100 bg-white px-5 py-3 text-xs text-stone-500 shadow-sm">
          <Info className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          Beveiligd via <strong className="text-stone-700">iDEAL</strong> · Veilige betaling via Stripe
        </div>
      </div>
    </div>
  );
}

export function PricingPage() {
  return (
    <Elements stripe={stripePromise}>
      <PricingContent />
    </Elements>
  );
}
