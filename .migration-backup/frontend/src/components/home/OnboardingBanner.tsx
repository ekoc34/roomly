import Link from "next/link";

export function OnboardingBanner() {
  return (
    <div className="mt-10 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Roomly is een gratis huisvestingsplatform voor heel Nederland
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-blue-800/80">
              Heb je een kamer of appartement te huur? Plaats je advertentie
              gratis en bereik duizenden geverifieerde huurders.
            </p>
          </div>
        </div>
        <Link
          href="/kamers/nieuw"
          data-testid="onboarding-banner-cta"
          className="shrink-0 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 active:scale-95"
        >
          Advertentie plaatsen →
        </Link>
      </div>
    </div>
  );
}
