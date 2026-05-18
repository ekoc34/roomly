import { Search, MessageSquare, Home, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function WhyRoomly() {
  const { t } = useLanguage();

  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-stone-200/80 bg-white px-6 py-12 shadow-sm sm:px-10">

        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">{t("home.whyTitle")}</p>
          <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">{t("home.whySubtitle")}</h2>
        </div>

        {/* Steps with connector */}
        <div className="relative mt-12">

          {/* Horizontal connector line — desktop only */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[22px] hidden h-px bg-stone-200 lg:block"
            style={{ left: "calc(100% / 6)", right: "calc(100% / 6)" }}
          />

          <div className="grid lg:grid-cols-3">

            {/* Step 1 */}
            <div className="flex flex-col items-center px-6 text-center">
              <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-2 ring-rose-100">
                <Search className="h-5 w-5 text-rose-500" strokeWidth={2} />
              </div>
              <div aria-hidden="true" className="mt-3 h-8 w-px bg-stone-200 lg:hidden" />
              <div className="mt-4 lg:mt-6">
                <p className="text-xs font-semibold text-rose-400">01</p>
                <p className="mt-1 font-semibold text-stone-900">{t("home.whyStep1Title")}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{t("home.whyStep1Desc")}</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center px-6 text-center">
              <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-2 ring-rose-100">
                <MessageSquare className="h-5 w-5 text-rose-500" strokeWidth={2} />
              </div>
              <div aria-hidden="true" className="mt-3 h-8 w-px bg-stone-200 lg:hidden" />
              <div className="mt-4 lg:mt-6">
                <p className="text-xs font-semibold text-rose-400">02</p>
                <p className="mt-1 font-semibold text-stone-900">{t("home.whyStep2Title")}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{t("home.whyStep2Desc")}</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center px-6 text-center">
              <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-2 ring-rose-100">
                <Home className="h-5 w-5 text-rose-500" strokeWidth={2} />
              </div>
              <div className="mt-4 lg:mt-6">
                <p className="text-xs font-semibold text-rose-400">03</p>
                <p className="mt-1 font-semibold text-stone-900">{t("home.whyStep3Title")}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{t("home.whyStep3Desc")}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.whyBadge1")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.whyBadge2")}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Trust banner */}
        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-6 py-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-200/60">
            <ShieldCheck className="h-5 w-5 text-emerald-600" strokeWidth={2} />
          </div>
          <p className="text-sm leading-relaxed text-stone-600">
            <span className="font-semibold text-stone-900">{t("home.whyBadge3")}.</span>{" "}
            {t("home.whyBadge3Desc")}
          </p>
        </div>

      </div>
    </section>
  );
}
