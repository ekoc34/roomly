import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

type Prefs = {
  analytisch: boolean;
  functioneel: boolean;
  marketing: boolean;
};

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${enabled ? "bg-rose-500" : "bg-stone-200"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

const categories = [
  {
    key: "analytisch" as keyof Prefs,
    title: "Analytische cookies",
    icon: "📊",
    description: "Helpen ons begrijpen hoe het platform gebruikt wordt, zodat we het kunnen verbeteren. De gegevens zijn geanonimiseerd.",
    required: false,
  },
  {
    key: "functioneel" as keyof Prefs,
    title: "Functionele cookies",
    icon: "⚙️",
    description: "Onthouden je voorkeuren zoals je geselecteerde stad en zoekfilters voor een prettigere ervaring.",
    required: false,
  },
  {
    key: "marketing" as keyof Prefs,
    title: "Marketingcookies",
    icon: "📣",
    description: "Momenteel niet actief. Welkthuis gebruikt geen marketingcookies of gepersonaliseerde advertenties.",
    required: false,
    disabled: true,
  },
];

export function CookieVoorkeurenPage() {
  const [prefs, setPrefs] = useState<Prefs>({
    analytisch: true,
    functioneel: true,
    marketing: false,
  });
  const [saved, setSaved] = useState(false);

  const save = (newPrefs: Prefs) => {
    setPrefs(newPrefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const acceptAll = () => save({ analytisch: true, functioneel: true, marketing: false });
  const rejectAll = () => save({ analytisch: false, functioneel: false, marketing: false });

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
            Je bepaalt zelf welke cookies je toestaat. Noodzakelijke cookies zijn altijd actief — die zorgen ervoor dat het platform werkt. De rest is aan jou.
          </p>
        </div>

        <div className="space-y-4">
          {/* Noodzakelijk — altijd actief */}
          <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xl leading-none">🔒</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-stone-900">Noodzakelijke cookies</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Altijd actief</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-stone-500">
                    Vereist voor inloggen, beveiliging en basisfuncties. Deze cookies kunnen niet worden uitgeschakeld.
                  </p>
                </div>
              </div>
              <div className="shrink-0 opacity-40">
                <Toggle enabled={true} onChange={() => {}} />
              </div>
            </div>
          </div>

          {/* Optionele categorieën */}
          {categories.map((cat) => (
            <div
              key={cat.key}
              className={`rounded-2xl border p-5 transition-colors ${prefs[cat.key] && !cat.disabled ? "border-rose-200 bg-rose-50/30" : "border-stone-100 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-xl leading-none">{cat.icon}</span>
                  <div>
                    <p className="font-semibold text-stone-900">{cat.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-500">{cat.description}</p>
                  </div>
                </div>
                <div className={`shrink-0 ${cat.disabled ? "opacity-30" : ""}`}>
                  <Toggle
                    enabled={prefs[cat.key]}
                    onChange={(v) => {
                      if (cat.disabled) return;
                      setPrefs((p) => ({ ...p, [cat.key]: v }));
                      setSaved(false);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => save(prefs)}
              className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              Voorkeuren opslaan
            </button>
            <button
              onClick={acceptAll}
              className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Alles accepteren
            </button>
            <button
              onClick={rejectAll}
              className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-500 shadow-sm transition hover:bg-stone-50"
            >
              Alleen noodzakelijk
            </button>
          </div>

          {saved && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Opgeslagen
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-stone-100 pt-8 text-sm text-stone-400">
          <p>Je kunt je voorkeuren op elk moment aanpassen. Meer informatie vind je op de <Link href="/cookies" className="text-rose-500 hover:underline">cookiepagina</Link> of in het <Link href="/privacy" className="text-rose-500 hover:underline">privacybeleid</Link>.</p>
        </div>
      </div>
    </>
  );
}
