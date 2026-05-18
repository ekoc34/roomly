import { useRef, useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";

const OPTIONS: { value: Language; flag: string; label: string }[] = [
  { value: "nl", flag: "🇳🇱", label: "Nederlands" },
  { value: "en", flag: "🇬🇧", label: "English" },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const current = OPTIONS.find((o) => o.value === language) ?? OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Taal wisselen / Change language"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-[18px] leading-none shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-95"
      >
        {current.flag}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl shadow-stone-200/60">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setLanguage(opt.value); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition hover:bg-stone-50 ${
                language === opt.value
                  ? "font-semibold text-stone-900"
                  : "font-normal text-stone-600"
              }`}
            >
              <span className="text-[18px] leading-none">{opt.flag}</span>
              <span>{opt.label}</span>
              {language === opt.value && (
                <svg className="ml-auto h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
