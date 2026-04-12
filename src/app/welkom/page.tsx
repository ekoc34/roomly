import Link from "next/link";

export default function WelkomPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center">
          <span className="text-4xl">👋</span>
          <h1 className="mt-4 text-3xl font-black text-stone-900 sm:text-4xl">
            Welkom bij Roomly
          </h1>
          <p className="mt-3 text-base leading-relaxed text-stone-500">
            We helpen je op weg. Wat ben je van plan?
          </p>
        </div>

        {/* Choice cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/kamers"
            className="group flex flex-col items-start gap-4 rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 transition group-hover:bg-rose-100">
              <svg
                className="h-6 w-6 text-rose-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-stone-900 group-hover:text-rose-600">
                Ik zoek een kamer
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                Bekijk beschikbare kamers en mede-huurders in Amsterdam.
              </p>
            </div>
            <span className="mt-auto text-xs font-semibold text-rose-500 group-hover:underline">
              Bekijk kamers →
            </span>
          </Link>

          <Link
            href="/kamers/nieuw"
            className="group flex flex-col items-start gap-4 rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 transition group-hover:bg-emerald-100">
              <svg
                className="h-6 w-6 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-stone-900 group-hover:text-emerald-600">
                Ik bied een kamer aan
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                Plaats je advertentie en bereik direct studenten.
              </p>
            </div>
            <span className="mt-auto text-xs font-semibold text-emerald-500 group-hover:underline">
              Advertentie plaatsen →
            </span>
          </Link>
        </div>

        {/* Skip */}
        <p className="mt-8 text-center text-sm text-stone-400">
          Liever later kiezen?{" "}
          <Link href="/dashboard" className="font-medium text-stone-600 hover:text-rose-600 hover:underline">
            Ga naar je dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
