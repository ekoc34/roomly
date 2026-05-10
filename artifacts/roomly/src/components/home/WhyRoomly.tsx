import { Search, MessageSquare, Home, ShieldCheck } from "lucide-react";

export function WhyRoomly() {
  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-stone-200/80 bg-white px-6 py-12 shadow-sm sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Hoe het werkt</p>
          <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">Vind je nieuwe thuis in drie stappen</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Stap 1 */}
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <Search className="h-5 w-5 text-rose-500" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-400">01</p>
              <p className="mt-0.5 font-semibold text-stone-900">Stap 1: Zoek je woning</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">Gebruik filters op stad, prijs, type woning en meer. Vind kamers, appartementen en huisgenootplaatsen in heel Nederland.</p>
            </div>
          </div>

          {/* Geverifieerde gebruikers — trust signal, visually distinct */}
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-200/60">
              <ShieldCheck className="h-5 w-5 text-emerald-600" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600">Veiligheid</p>
              <p className="mt-0.5 font-semibold text-stone-900">Geverifieerde gebruikers</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">E-mailadressen en telefoonnummers kunnen worden geverifieerd voor extra veiligheid. Je weet met wie je praat.</p>
            </div>
          </div>

          {/* Stap 2 */}
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <MessageSquare className="h-5 w-5 text-rose-500" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-400">02</p>
              <p className="mt-0.5 font-semibold text-stone-900">Stap 2: Reageer direct</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">Stuur een bericht naar de verhuurder via in-app chat. Geen WhatsApp-links, geen e-mailadres delen — alles gaat via het platform.</p>
            </div>
          </div>

          {/* Stap 3 */}
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <Home className="h-5 w-5 text-rose-500" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-400">03</p>
              <p className="mt-0.5 font-semibold text-stone-900">Stap 3: Verhuis naar je nieuwe thuis</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">Spreek een bezichtiging af, rond alles af en verhuis. Zonder abonnement, zonder verborgen kosten voor huurders of verhuurders.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
