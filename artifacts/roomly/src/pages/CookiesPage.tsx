import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const categories = [
  {
    id: "noodzakelijk",
    title: "Noodzakelijke cookies",
    badge: "Altijd actief",
    badgeColor: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    iconPath: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
    iconColor: "bg-emerald-50 text-emerald-600",
    summary: "Vereist voor inloggen, beveiliging en basisfuncties.",
    details: (
      <>
        <p>Noodzakelijke cookies zorgen ervoor dat het platform goed werkt. Zonder deze cookies kun je niet inloggen, geen advertenties plaatsen of gebruikmaken van de berichtenfunctie. Ze worden altijd geplaatst.</p>
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
              <tr>
                <td className="px-4 py-2.5 font-mono">sb-auth-token</td>
                <td className="px-4 py-2.5">Authenticatiesessie bijhouden</td>
                <td className="px-4 py-2.5">Sessie</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">sb-refresh-token</td>
                <td className="px-4 py-2.5">Ingelogd blijven bij terugkeer</td>
                <td className="px-4 py-2.5">7 dagen</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">Derde partijen: geen. Deze cookies worden alleen door Welkthuis geplaatst en verwerkt.</p>
      </>
    ),
  },
  {
    id: "analytisch",
    title: "Analytische cookies",
    badge: "Optioneel",
    badgeColor: "bg-stone-100 text-stone-500",
    iconPath: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    iconColor: "bg-blue-50 text-blue-500",
    summary: "Helpen ons begrijpen hoe het platform gebruikt wordt, zodat we het kunnen verbeteren.",
    details: (
      <>
        <p>Analytische cookies geven ons inzicht in hoe bezoekers het platform gebruiken — welke pagina's populair zijn en waar verbeteringen nodig zijn. De verzamelde gegevens zijn geanonimiseerd en worden nooit gebruikt om je persoonlijk te volgen of te profileren.</p>
        <p className="mt-2">We gebruiken hiervoor Google Analytics met IP-anonimisering ingeschakeld. Dat betekent dat je IP-adres wordt afgekapt vóórdat het wordt opgeslagen — Google kan je niet identificeren op basis van deze data.</p>
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
              <tr>
                <td className="px-4 py-2.5 font-mono">_ga</td>
                <td className="px-4 py-2.5">Geanonimiseerde bezoekersstatistieken</td>
                <td className="px-4 py-2.5">2 jaar</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">_ga_*</td>
                <td className="px-4 py-2.5">Sessie-identificatie (geanonimiseerd)</td>
                <td className="px-4 py-2.5">2 jaar</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">Derde partijen: Google Analytics (geanonimiseerd, IP-masking ingeschakeld). Geen advertentieprofilering of retargeting.</p>
      </>
    ),
  },
  {
    id: "functioneel",
    title: "Functionele cookies",
    badge: "Optioneel",
    badgeColor: "bg-stone-100 text-stone-500",
    iconPath: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    iconColor: "bg-amber-50 text-amber-500",
    summary: "Onthouden je voorkeuren voor een prettigere ervaring.",
    details: (
      <>
        <p>Functionele cookies zorgen ervoor dat het platform jouw voorkeuren onthoudt, zoals je geselecteerde stad of toegepaste zoekfilters. Ze zijn niet strikt noodzakelijk, maar maken het gebruik aangenamer — je hoeft je voorkeuren niet elke keer opnieuw in te stellen.</p>
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
              <tr>
                <td className="px-4 py-2.5 font-mono">wt_city</td>
                <td className="px-4 py-2.5">Geselecteerde stad onthouden</td>
                <td className="px-4 py-2.5">30 dagen</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">wt_filters</td>
                <td className="px-4 py-2.5">Zoekfiltervoorkeuren onthouden</td>
                <td className="px-4 py-2.5">7 dagen</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">Derde partijen: geen. Alleen Welkthuis plaatst en leest deze cookies.</p>
      </>
    ),
  },
  {
    id: "marketing",
    title: "Marketingcookies",
    badge: "Niet actief",
    badgeColor: "bg-stone-100 text-stone-400",
    iconPath: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46",
    iconColor: "bg-stone-100 text-stone-400",
    summary: "We gebruiken momenteel geen marketingcookies.",
    details: (
      <p>
        Welkthuis maakt momenteel geen gebruik van marketingcookies of retargeting. We tonen geen gepersonaliseerde advertenties via externe netwerken. Mocht dit in de toekomst veranderen, dan informeren we je vooraf via e-mail en via een update op deze pagina. Je hebt altijd de keus.
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
            We gebruiken cookies om het platform goed te laten werken en om het te verbeteren. Hieronder vind je precies welke cookies we gebruiken, waarom, en hoe lang ze actief zijn.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/cookievoorkeuren"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              Mijn cookievoorkeuren beheren →
            </Link>
          </div>
        </div>

        <div className="space-y-2.5">
          {categories.map((cat) => {
            const isOpen = open === cat.id;
            return (
              <div
                key={cat.id}
                className={`overflow-hidden rounded-2xl border transition-colors duration-150 ${isOpen ? "border-stone-200 bg-white shadow-sm" : "border-stone-100 bg-stone-50/60"}`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : cat.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cat.iconColor}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-900">{cat.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.badgeColor}`}>{cat.badge}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">{cat.summary}</p>
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
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

        <div className="mt-10 rounded-2xl border border-stone-100 bg-stone-50 p-5">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div className="text-sm text-stone-500">
              <span className="font-medium text-stone-700">Je voorkeuren aanpassen</span>
              {" "}— Je kunt je cookievoorkeuren op elk moment aanpassen via de{" "}
              <Link href="/cookievoorkeuren" className="text-rose-600 hover:underline">cookievoorkeuren pagina</Link>.
              Noodzakelijke cookies blijven altijd actief — die kun je niet uitschakelen zonder de basisfuncties van het platform te verliezen.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
