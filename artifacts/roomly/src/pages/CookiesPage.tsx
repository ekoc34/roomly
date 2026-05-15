import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const categories = [
  {
    id: "noodzakelijk",
    title: "Noodzakelijke cookies",
    badge: "Altijd actief",
    badgeColor: "bg-emerald-50 text-emerald-700",
    icon: "🔒",
    summary: "Vereist voor de basisfuncties van het platform.",
    details: (
      <>
        <p>Noodzakelijke cookies zorgen ervoor dat het platform goed werkt. Zonder deze cookies kun je niet inloggen, geen advertenties plaatsen of gebruik maken van de berichtenfunctie.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-stone-100">
          <table className="w-full text-xs text-stone-600">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium text-stone-500">Cookie</th>
                <th className="px-4 py-2.5 font-medium text-stone-500">Doel</th>
                <th className="px-4 py-2.5 font-medium text-stone-500">Looptijd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr><td className="px-4 py-2.5 font-mono">sb-auth-token</td><td className="px-4 py-2.5">Authenticatie sessie</td><td className="px-4 py-2.5">Sessie</td></tr>
              <tr><td className="px-4 py-2.5 font-mono">sb-refresh-token</td><td className="px-4 py-2.5">Sessie vernieuwen</td><td className="px-4 py-2.5">7 dagen</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">Derde partijen: geen. Deze cookies worden alleen door Welkthuis geplaatst.</p>
      </>
    ),
  },
  {
    id: "analytisch",
    title: "Analytische cookies",
    badge: "Optioneel",
    badgeColor: "bg-stone-100 text-stone-500",
    icon: "📊",
    summary: "Helpen ons begrijpen hoe het platform gebruikt wordt.",
    details: (
      <>
        <p>Analytische cookies geven ons inzicht in hoe bezoekers het platform gebruiken — welke pagina's populair zijn en waar verbeteringen nodig zijn. De gegevens zijn geanonimiseerd en worden nooit gebruikt om je persoonlijk te volgen.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-stone-100">
          <table className="w-full text-xs text-stone-600">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium text-stone-500">Cookie</th>
                <th className="px-4 py-2.5 font-medium text-stone-500">Doel</th>
                <th className="px-4 py-2.5 font-medium text-stone-500">Looptijd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr><td className="px-4 py-2.5 font-mono">_ga</td><td className="px-4 py-2.5">Bezoekersstatistieken (Google Analytics)</td><td className="px-4 py-2.5">2 jaar</td></tr>
              <tr><td className="px-4 py-2.5 font-mono">_ga_*</td><td className="px-4 py-2.5">Sessie-identificatie</td><td className="px-4 py-2.5">2 jaar</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">Derde partijen: Google Analytics (geanonimiseerd). Geen advertentieprofilering.</p>
      </>
    ),
  },
  {
    id: "functioneel",
    title: "Functionele cookies",
    badge: "Optioneel",
    badgeColor: "bg-stone-100 text-stone-500",
    icon: "⚙️",
    summary: "Onthouden je voorkeuren voor een betere ervaring.",
    details: (
      <>
        <p>Functionele cookies zorgen ervoor dat het platform jouw voorkeuren onthoudt, zoals je taalinstelling, filterkeuzes of de stad die je als favoriet hebt ingesteld. Ze zijn niet strikt noodzakelijk, maar maken het gebruik aangenamer.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-stone-100">
          <table className="w-full text-xs text-stone-600">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium text-stone-500">Cookie</th>
                <th className="px-4 py-2.5 font-medium text-stone-500">Doel</th>
                <th className="px-4 py-2.5 font-medium text-stone-500">Looptijd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr><td className="px-4 py-2.5 font-mono">wt_city</td><td className="px-4 py-2.5">Geselecteerde stad onthouden</td><td className="px-4 py-2.5">30 dagen</td></tr>
              <tr><td className="px-4 py-2.5 font-mono">wt_filters</td><td className="px-4 py-2.5">Zoekfilters onthouden</td><td className="px-4 py-2.5">7 dagen</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">Derde partijen: geen. Alleen Welkthuis gebruikt deze cookies.</p>
      </>
    ),
  },
  {
    id: "marketing",
    title: "Marketingcookies",
    badge: "Niet actief",
    badgeColor: "bg-stone-100 text-stone-400",
    icon: "📣",
    summary: "We gebruiken momenteel geen marketingcookies.",
    details: (
      <p>
        Welkthuis maakt momenteel geen gebruik van marketingcookies of retargeting. We tonen geen gepersonaliseerde advertenties via externe netwerken. Mocht dit in de toekomst veranderen, dan informeren we je hierover via e-mail en via deze pagina.
      </p>
    ),
  },
];

export function CookiesPage() {
  const [open, setOpen] = useState<string | null>("noodzakelijk");

  return (
    <>
      <Helmet>
        <title>Cookies — Welkthuis.nl</title>
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Juridisch</p>
          <h1 className="mt-2 text-3xl font-black text-stone-900 sm:text-4xl">Cookies</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-500">
            We gebruiken cookies om het platform goed te laten werken en te verbeteren. Hieronder vind je precies welke cookies we gebruiken en waarom.
          </p>
          <div className="mt-4">
            <Link
              href="/cookievoorkeuren"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              Mijn cookievoorkeuren beheren →
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((cat) => {
            const isOpen = open === cat.id;
            return (
              <div
                key={cat.id}
                className={`overflow-hidden rounded-2xl border transition-colors ${isOpen ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50/60"}`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : cat.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="text-xl leading-none">{cat.icon}</span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-900">{cat.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.badgeColor}`}>{cat.badge}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">{cat.summary}</p>
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-stone-100 px-5 pb-5 pt-4 text-sm leading-relaxed text-stone-600">
                    {cat.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl bg-stone-50 p-6 text-sm text-stone-500">
          <p className="font-medium text-stone-700">Je voorkeuren aanpassen</p>
          <p className="mt-1">Je kunt je cookievoorkeuren op elk moment aanpassen via de <Link href="/cookievoorkeuren" className="text-rose-600 hover:underline">cookievoorkeuren pagina</Link>.</p>
        </div>
      </div>
    </>
  );
}
