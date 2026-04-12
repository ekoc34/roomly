import Link from "next/link";

export function HeroSearch() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50/60 px-6 py-14 shadow-sm ring-1 ring-stone-200/60 sm:px-10 sm:py-20">
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
          Voor studenten in Amsterdam
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
          Vind snel een kamer in Amsterdam{" "}
          <span className="text-rose-500">zonder gedoe</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
          Vind een kamer, reageer direct en spreek af met de verhuurder.
          Gratis voor studenten — altijd.
        </p>
        <form
          action="/kamers"
          method="get"
          className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-stretch"
        >
          <label className="sr-only" htmlFor="hero-q">
            Zoekopdracht
          </label>
          <input
            id="hero-q"
            name="q"
            type="search"
            placeholder="Zoek op wijk, prijs of type kamer..."
            className="min-h-12 flex-1 rounded-2xl border border-stone-200 bg-white px-4 text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button
            type="submit"
            className="min-h-12 rounded-2xl bg-rose-500 px-6 font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95"
          >
            Bekijk kamers
          </button>
        </form>
        <div className="mt-5">
          <Link
            href="/kamers"
            className="text-sm font-medium text-rose-600 underline-offset-4 hover:underline"
          >
            Bekijk alle kamers →
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium text-emerald-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            E-mail geverifieerd
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
            </svg>
            Alleen studenten
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 shadow-sm">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Geen spam
          </span>
        </div>
      </div>
    </section>
  );
}
