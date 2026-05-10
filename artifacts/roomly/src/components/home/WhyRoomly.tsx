import { Search, MessageSquare, Home } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Search,
    title: "Stap 1: Zoek je woning",
    description: "Gebruik filters op stad, prijs, type woning en meer. Vind kamers, appartementen en huisgenootplaatsen in heel Nederland.",
  },
  {
    number: "02",
    icon: MessageSquare,
    title: "Stap 2: Reageer direct",
    description: "Stuur een bericht naar de verhuurder via in-app chat. Geen WhatsApp-links, geen e-mailadres delen — alles gaat via het platform.",
  },
  {
    number: "03",
    icon: Home,
    title: "Stap 3: Verhuis naar je nieuwe thuis",
    description: "Spreek een bezichtiging af, rond alles af en verhuis. Zonder abonnement, zonder verborgen kosten voor huurders of verhuurders.",
  },
];

export function WhyRoomly() {
  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-stone-200/80 bg-white px-6 py-12 shadow-sm sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Hoe het werkt</p>
          <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">Vind je nieuwe thuis in drie stappen</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ number, icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
                <Icon className="h-5 w-5 text-rose-500" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-400">{number}</p>
                <p className="mt-0.5 font-semibold text-stone-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-500">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
