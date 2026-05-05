const ITEMS = [
  {
    icon: (
      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Geverifieerde gebruikers",
    description:
      "Universiteitsmailadressen worden automatisch geverifieerd. Voor verhuurders komt er telefoonverificatie. Je weet met wie je praat.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "In-app berichten",
    description:
      "Chat direct met de verhuurder in het platform. Geen WhatsApp-links, geen e-mailadres delen, geen gedoe.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    title: "Gratis — altijd",
    description:
      "Geen abonnementen, geen verborgen kosten voor huurders of verhuurders. Plaats en reageer zo vaak je wilt.",
  },
];

export function WhyRoomly() {
  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-stone-200/80 bg-white px-6 py-12 shadow-sm sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            Waarom Roomly
          </p>
          <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
            Huizen vinden, eerlijk en simpel
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            Een platform waar studenten, professionals, expats en families hun
            volgende woonplek vinden — met vertrouwde tools en zonder abonnement.
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
