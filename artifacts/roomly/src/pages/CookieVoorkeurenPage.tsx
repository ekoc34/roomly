import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { getConsent, setConsent } from "@/lib/cookieConsent";

type Prefs = {
  analytisch: boolean;
  marketing: boolean;
};

function Toggle({
  enabled,
  onChange,
  disabled = false,
  id,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${enabled ? "bg-rose-500" : "bg-stone-200"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const OPTIONAL_CATEGORIES: {
  key: keyof Prefs;
  title: string;
  description: string;
  detail: string;
  iconPath: string;
  iconColor: string;
  disabled?: boolean;
}[] = [
  {
    key: "analytisch",
    title: "Analytische cookies",
    iconPath:
      "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    iconColor: "bg-blue-50 text-blue-500",
    description: "Helpen ons begrijpen hoe het platform gebruikt wordt.",
    detail:
      "We gebruiken geanonimiseerde statistieken om te zien welke pagina's populair zijn en waar we het platform kunnen verbeteren. De data is niet te herleiden tot jou als persoon.",
    disabled: false,
  },
  {
    key: "marketing",
    title: "Marketingcookies",
    iconPath:
      "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46",
    iconColor: "bg-stone-100 text-stone-400",
    description: "Momenteel niet actief op Welkthuis.",
    detail:
      "We gebruiken geen marketingcookies of gepersonaliseerde advertenties. Deze categorie is hier alleen zichtbaar voor transparantie. Mocht dit ooit veranderen, informeren we je vooraf.",
    disabled: true,
  },
];

export function CookieVoorkeurenPage() {
  const [prefs, setPrefs] = useState<Prefs>({ analytisch: false, marketing: false });
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const existing = getConsent();
    if (existing) {
      setPrefs({ analytisch: existing.analytisch, marketing: existing.marketing });
    }
    setLoaded(true);
  }, []);

  function save(newPrefs: Prefs) {
    setConsent(newPrefs);
    setPrefs(newPrefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  const acceptAll = () => save({ analytisch: true, marketing: false });
  const rejectAll = () => save({ analytisch: false, marketing: false });

  return (
    <>
      <Helmet>
        <title>Cookievoorkeuren — Welkthuis.nl</title>
      </Helmet>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Juridisch</p>
          <h1 className="mt-2 text-3xl font-black text-stone-900 sm:text-4xl">Cookievoorkeuren</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-500">
            Jij bepaalt welke cookies je toestaat. Noodzakelijke cookies zijn altijd actief — die zorgen ervoor dat het platform werkt. De overige keuzes zijn volledig aan jou.
          </p>
        </div>

        {loaded && (
          <div className="space-y-3">
            {/* Noodzakelijk — altijd actief */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="font-semibold text-stone-900">Noodzakelijke cookies</label>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Altijd actief
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">
                      Vereist voor inloggen, beveiliging en basisfuncties. Zonder deze cookies werkt het platform niet.
                    </p>
                    <p className="mt-1.5 text-xs text-stone-400">
                      Voorbeelden: inlogsessie bijhouden, ingelogd blijven bij terugkeer. Looptijd: sessie tot 7 dagen.
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Toggle id="toggle-noodzakelijk" enabled={true} onChange={() => {}} disabled={true} />
                </div>
              </div>
            </div>

            {/* Optionele categorieën */}
            {OPTIONAL_CATEGORIES.map((cat) => {
              const isEnabled = prefs[cat.key] && !cat.disabled;
              return (
                <div
                  key={cat.key}
                  className={`rounded-2xl border p-5 transition-colors duration-150 ${
                    cat.disabled
                      ? "border-stone-100 bg-stone-50/50"
                      : isEnabled
                      ? "border-stone-200 bg-white"
                      : "border-stone-100 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cat.iconColor} ${
                          cat.disabled ? "opacity-50" : ""
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
                        </svg>
                      </span>
                      <div>
                        <label
                          htmlFor={`toggle-${cat.key}`}
                          className={`font-semibold ${cat.disabled ? "text-stone-400" : "text-stone-900"}`}
                        >
                          {cat.title}
                        </label>
                        <p className="mt-1 text-sm leading-relaxed text-stone-500">{cat.description}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{cat.detail}</p>
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      <Toggle
                        id={`toggle-${cat.key}`}
                        enabled={prefs[cat.key]}
                        disabled={cat.disabled}
                        onChange={(v) => {
                          if (cat.disabled) return;
                          setPrefs((p) => ({ ...p, [cat.key]: v }));
                          setSaved(false);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save confirmation */}
        {saved && (
          <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Je cookievoorkeuren zijn opgeslagen.</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => save(prefs)}
            className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          >
            Voorkeuren opslaan
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2"
          >
            Alles accepteren
          </button>
          <button
            type="button"
            onClick={rejectAll}
            className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-500 shadow-sm transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2"
          >
            Alleen noodzakelijk
          </button>
        </div>

        <div className="mt-10 border-t border-stone-100 pt-8 text-sm leading-relaxed text-stone-400">
          <p>
            Je kunt je voorkeuren op elk moment aanpassen — kom gewoon terug naar deze pagina. Meer informatie vind je op de{" "}
            <Link href="/cookies" className="text-rose-500 hover:underline">
              cookiepagina
            </Link>{" "}
            of in ons{" "}
            <Link href="/privacy" className="text-rose-500 hover:underline">
              privacybeleid
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
