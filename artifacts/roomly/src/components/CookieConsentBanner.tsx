import { useEffect, useRef, useState } from "react";
import { getConsent, hasConsented, setConsent } from "@/lib/cookieConsent";
import { useLanguage } from "@/contexts/LanguageContext";

type Prefs = { analytisch: boolean; marketing: boolean };

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

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ analytisch: false, marketing: false });
  const panelRef = useRef<HTMLDivElement>(null);
  const firstBtnRef = useRef<HTMLButtonElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!hasConsented()) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => firstBtnRef.current?.focus(), 80);
    return () => clearTimeout(timeout);
  }, [visible]);

  useEffect(() => {
    if (!showPrefs) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPrefs(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showPrefs]);

  useEffect(() => {
    if (showPrefs) {
      const existing = getConsent();
      if (existing) {
        setPrefs({ analytisch: existing.analytisch, marketing: existing.marketing });
      }
    }
  }, [showPrefs]);

  if (!visible) return null;

  function acceptAll() {
    setConsent({ analytisch: true, marketing: true });
    setVisible(false);
  }

  function acceptNecessaryOnly() {
    setConsent({ analytisch: false, marketing: false });
    setVisible(false);
  }

  function saveCustom() {
    setConsent(prefs);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("cookie.title")}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-stone-900/5">
        <div className="px-6 pt-6 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50">
              <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
            <h2 className="text-base font-bold text-stone-900">{t("cookie.title")}</h2>
          </div>
          <p className="text-sm leading-relaxed text-stone-500">
            {t("cookie.desc")}
          </p>
        </div>

        {showPrefs && (
          <div ref={panelRef} className="px-6 py-4 border-b border-stone-100 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-stone-800">{t("cookie.necessary")}</label>
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{t("cookie.necessaryAlways")}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-400">{t("cookie.necessaryDesc")}</p>
                </div>
              </div>
              <Toggle id="toggle-noodzakelijk" enabled={true} onChange={() => {}} disabled={true} />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </span>
                <div>
                  <label htmlFor="toggle-analytisch" className="text-sm font-semibold text-stone-800">{t("cookie.analytics")}</label>
                  <p className="mt-0.5 text-xs text-stone-400">{t("cookie.analyticsDesc")}</p>
                </div>
              </div>
              <Toggle
                id="toggle-analytisch"
                enabled={prefs.analytisch}
                onChange={(v) => setPrefs((p) => ({ ...p, analytisch: v }))}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100">
                  <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                  </svg>
                </span>
                <div>
                  <label htmlFor="toggle-marketing" className="text-sm font-semibold text-stone-400">{t("cookie.marketing")}</label>
                  <p className="mt-0.5 text-xs text-stone-400">{t("cookie.marketingDesc")}</p>
                </div>
              </div>
              <Toggle
                id="toggle-marketing"
                enabled={prefs.marketing}
                onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
              />
            </div>
          </div>
        )}

        <div className="px-6 py-5 flex flex-col gap-2.5">
          {showPrefs ? (
            <button
              type="button"
              onClick={saveCustom}
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2"
            >
              {t("cookie.savePreferences")}
            </button>
          ) : (
            <button
              type="button"
              ref={firstBtnRef}
              onClick={() => setShowPrefs(true)}
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2"
            >
              {t("cookie.changePreferences")}
            </button>
          )}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={acceptNecessaryOnly}
              className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2"
            >
              {t("cookie.necessaryOnly")}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2"
            >
              {t("cookie.acceptAll")}
            </button>
          </div>
        </div>

        <div className="px-6 pb-5 -mt-1 text-center">
          <a
            href="/cookies"
            className="text-xs text-stone-400 hover:text-stone-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 rounded"
          >
            {t("cookie.moreInfo")}
          </a>
        </div>
      </div>
    </div>
  );
}
