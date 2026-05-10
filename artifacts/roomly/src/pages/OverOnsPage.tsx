import { Helmet } from "react-helmet-async";
import { Search, ShieldCheck, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Geverifieerde gebruikers",
    description:
      "E-mailadressen en telefoonnummers kunnen worden geverifieerd voor extra veiligheid. Je weet met wie je praat.",
  },
  {
    icon: MessageSquare,
    title: "In-app berichten",
    description:
      "Chat direct met de verhuurder in het platform. Geen WhatsApp-links, geen e-mailadres delen, geen gedoe.",
  },
  {
    icon: Search,
    title: "Zonder abonnement",
    description:
      "Geen verborgen kosten voor huurders of verhuurders. Plaats en reageer zo vaak je wilt.",
  },
];

export function OverOnsPage() {
  return (
    <>
      <Helmet>
        <title>Over ons — Welkthuis.nl</title>
        <meta
          name="description"
          content="Leer meer over Welkthuis — het platform voor woningen in Nederland, eerlijk, duidelijk en snel."
        />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-500">
            Over Welkthuis
          </p>
          <h1 className="mt-3 text-4xl font-black text-stone-900 sm:text-5xl">
            Woningen vinden in Nederland —{" "}
            <span className="text-rose-500">eerlijk, duidelijk en snel.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-stone-500 sm:text-lg">
            Een platform waar studenten, professionals, expats, families en
            alleenstaanden hun volgende woonplek vinden — of het nu gaat om
            kamerverhuur, een appartement of een huisgenoot. Zonder abonnement,
            met vertrouwde tools.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-1">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-start gap-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                <Icon className="h-5 w-5 text-rose-500" strokeWidth={2} />
              </div>
              <div>
                <p className="text-base font-semibold text-stone-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-500">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
