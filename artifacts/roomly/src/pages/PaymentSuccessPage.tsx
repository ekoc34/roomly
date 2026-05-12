import { Link } from "wouter";
import { CheckCircle } from "lucide-react";

export function PaymentSuccessPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-stone-200 bg-white p-12 shadow-sm">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle className="h-10 w-10 text-emerald-500" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-stone-900">Betaling succesvol!</h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Je Boost Credits zijn toegevoegd aan je account. Je kunt ze nu gebruiken om je advertenties extra zichtbaarheid te geven.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
          >
            Naar dashboard
          </Link>
          <Link
            href="/pricing"
            className="rounded-2xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Meer credits kopen
          </Link>
        </div>
      </div>
    </div>
  );
}
