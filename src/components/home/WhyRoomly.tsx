const ITEMS = [
  {
    icon: (
      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
      </svg>
    ),
    title: "Alleen studenten",
    description:
      "Roomly is uitsluitend voor studenten. Elk account is gekoppeld aan een e-mailadres en kan optioneel worden geverifieerd als student.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    title: "Geen spam advertenties",
    description:
      "Wij accepteren geen commerciële verhuurders of spam. Alle advertenties worden door echte studenten of particulieren geplaatst.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Veilig en transparant",
    description:
      "Duidelijke prijzen, geen verborgen kosten. We stimuleren transparante communicatie tussen huurder en verhuurder.",
  },
];

export function WhyRoomly() {
  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-stone-200/80 bg-white px-6 py-12 shadow-sm sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            Vertrouwen
          </p>
          <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
            Waarom Roomly?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            We bouwen een platform waar studenten zonder zorgen een kamer kunnen
            vinden of aanbieden.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-stone-900">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-500">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
