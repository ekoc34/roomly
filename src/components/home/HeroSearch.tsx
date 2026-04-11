import Link from "next/link";

export function HeroSearch() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50/60 px-6 py-14 shadow-sm ring-1 ring-stone-200/60 sm:px-10 sm:py-16">
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-rose-600">
          Voor studenten in Amsterdam
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl sm:leading-tight">
          Vind snel een kamer in Amsterdam
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
          Roomly helpt je een kamer, een mede-huurder of een kort verblijf te
          vinden. Duidelijke prijzen en betrouwbare advertenties.
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
            placeholder="Zoek op titel of buurt"
            className="min-h-12 flex-1 rounded-2xl border border-stone-200 bg-white px-4 text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button
            type="submit"
            className="min-h-12 rounded-2xl bg-rose-500 px-6 font-semibold text-white shadow-md transition hover:bg-rose-600"
          >
            Zoek een kamer
          </button>
        </form>
        <div className="mt-6">
          <Link
            href="/kamers"
            className="text-sm font-medium text-rose-600 underline-offset-4 hover:underline"
          >
            Bekijk alle kamers
          </Link>
        </div>
      </div>
    </section>
  );
}
