import { Helmet } from "react-helmet-async";

function RightIcon({ path }: { path: string }) {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </span>
  );
}

const rights = [
  {
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    title: "Inzage",
    desc: "Je kunt opvragen welke persoonsgegevens we van jou bewaren.",
  },
  {
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    title: "Correctie",
    desc: "Je kunt onjuiste of incomplete gegevens laten aanpassen.",
  },
  {
    icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    title: "Verwijdering",
    desc: "Je kunt vragen om volledige verwijdering van je account en gegevens.",
  },
  {
    icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
    title: "Bezwaar",
    desc: "Je kunt bezwaar maken tegen bepaalde verwerkingen, zoals voor analyse.",
  },
  {
    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
    title: "Dataportabiliteit",
    desc: "Je kunt je gegevens opvragen in een overdraagbaar formaat.",
  },
  {
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Beperking",
    desc: "Je kunt vragen om tijdelijke beperking van de verwerking van je gegevens.",
  },
];

const sections = [
  {
    title: "Welke gegevens we verzamelen",
    content: (
      <>
        <p>We verzamelen alleen gegevens die nodig zijn om het platform goed te laten werken:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Je naam, e-mailadres en wachtwoord bij registratie</li>
          <li>Profielinformatie die je zelf invult (foto, beschrijving, locatie, leefstijlkenmerken)</li>
          <li>Advertenties en berichten die je verstuurt via het platform</li>
          <li>Verificatiedocumenten als je vrijwillig kiest voor identiteitsverificatie</li>
          <li>Technische gegevens zoals je IP-adres en browsertype — uitsluitend voor beveiliging en fraudepreventie</li>
        </ul>
        <p className="mt-3 text-stone-500">We verzamelen geen gevoelige categorieën persoonsgegevens, zoals financiële rekeningnummers of medische informatie.</p>
      </>
    ),
  },
  {
    title: "Waarom we deze gegevens gebruiken",
    content: (
      <>
        <p>Je gegevens gebruiken we uitsluitend voor het volgende, op basis van de onderstaande grondslagen:</p>
        <div className="mt-3 space-y-2.5">
          {[
            { use: "Het aanmaken en beheren van je account", basis: "Uitvoering overeenkomst" },
            { use: "Het tonen van woningadvertenties en profielen", basis: "Uitvoering overeenkomst" },
            { use: "Communicatie tussen huurders, verhuurders en huisgenoten", basis: "Uitvoering overeenkomst" },
            { use: "Beveiliging en fraudepreventie", basis: "Gerechtvaardigd belang" },
            { use: "Verbetering van het platform op basis van gebruik", basis: "Toestemming (optioneel)" },
          ].map(({ use, basis }) => (
            <div key={use} className="flex flex-col gap-0.5 rounded-xl bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex-1 text-stone-700">{use}</span>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-stone-400 ring-1 ring-stone-200">{basis}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-stone-500">We verkopen je gegevens nooit aan derden en gebruiken ze niet voor advertentiedoeleinden van andere partijen.</p>
      </>
    ),
  },
  {
    title: "Account- en profielgegevens",
    content: (
      <>
        <p>Je profielinformatie is zichtbaar voor andere gebruikers, afhankelijk van je eigen privacy-instellingen. Je kunt op elk moment je profielfoto, beschrijving en zichtbaarheidsopties aanpassen via je profielpagina.</p>
        <p className="mt-2">Je e-mailadres is nooit openbaar zichtbaar — andere gebruikers zien alleen wat jij zelf deelt.</p>
      </>
    ),
  },
  {
    title: "Advertenties en berichten",
    content: (
      <>
        <p>Advertenties die je plaatst zijn publiekelijk zichtbaar voor iedereen die het platform gebruikt. Berichten die je verstuurt zijn uitsluitend zichtbaar voor de betrokken partijen — andere gebruikers hebben hier geen toegang toe.</p>
        <p className="mt-2">We bewaren berichten om eventuele geschillen te kunnen beoordelen en om het platform veilig te houden. Berichten worden niet automatisch gedeeld met derden.</p>
      </>
    ),
  },
  {
    title: "Verificatiegegevens",
    content: (
      <>
        <p>Als je ervoor kiest je identiteit te verifiëren, verwerken we de geüploade documenten uitsluitend voor dat doel. Na verwerking worden verificatiedocumenten niet langer bewaard dan strikt noodzakelijk.</p>
        <div className="mt-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Belangrijk</p>
          <p className="mt-1">Verificatiedocumenten zijn nooit zichtbaar voor andere gebruikers. Het verificatiebadge op je profiel geeft anderen vertrouwen — je documenten zelf blijven volledig privé.</p>
        </div>
      </>
    ),
  },
  {
    title: "Cookies en analytics",
    content: (
      <p>
        We gebruiken functionele cookies die noodzakelijk zijn voor het werken van het platform. Analytische cookies — zoals Google Analytics — gebruiken we geanonimiseerd om te begrijpen hoe het platform wordt gebruikt, zodat we het kunnen verbeteren. Ze zijn niet gekoppeld aan je persoonlijke identiteit. Je kunt je cookievoorkeuren op elk moment aanpassen. Zie onze{" "}
        <a href="/cookies" className="text-rose-600 underline underline-offset-2 hover:text-rose-700">cookiepagina</a> voor meer informatie.
      </p>
    ),
  },
  {
    title: "Hoe lang gegevens worden bewaard",
    content: (
      <>
        <p>We bewaren je gegevens zolang je account actief is. Na het verwijderen van je account:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Wordt je profiel en advertentiegeschiedenis direct verwijderd of geanonimiseerd</li>
          <li>Worden berichten geanonimiseerd — de inhoud blijft bewaard voor veiligheidscontroles, maar is niet meer te herleiden tot jou</li>
          <li>Kunnen wettelijk verplichte gegevens (zoals betalingsrecords) maximaal 7 jaar worden bewaard op basis van fiscale bewaarplicht</li>
          <li>Kunnen bepaalde technische logs tijdelijk bewaard blijven voor fraudepreventie</li>
        </ul>
        <p className="mt-3 text-stone-500">Accountverwijdering kan worden aangevraagd via je profielinstellingen of via ons contactformulier.</p>
      </>
    ),
  },
  {
    title: "Wanneer gegevens worden gedeeld",
    content: (
      <>
        <p>We delen je gegevens alleen in de volgende situaties:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Met andere gebruikers, voor zover nodig voor de dienst — zoals bij contactberichten</li>
          <li>Met technische dienstverleners die ons helpen het platform te draaien, zoals hosting- en authenticatieproviders</li>
          <li>Als dat wettelijk verplicht is, bijvoorbeeld bij een rechtmatig verzoek van een bevoegde autoriteit</li>
        </ul>
        <p className="mt-3">We sluiten verwerkersovereenkomsten af met alle partijen die namens ons persoonsgegevens verwerken, conform de AVG.</p>
      </>
    ),
  },
];

export function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Privacybeleid — Welkthuis.nl</title>
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Juridisch</p>
          <h1 className="mt-2 text-3xl font-black text-stone-900 sm:text-4xl">Privacybeleid</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-500">
            We gaan zorgvuldig om met je gegevens. Hieronder leggen we duidelijk uit wat we verzamelen, waarom, en wat jij daarin te zeggen hebt.
          </p>
          <p className="mt-2 text-sm text-stone-400">Laatst bijgewerkt: mei 2026</p>
        </div>

        <div className="space-y-10">
          {sections.map((section, i) => (
            <div key={i} className="border-t border-stone-100 pt-8">
              <h2 className="text-lg font-semibold text-stone-900">{section.title}</h2>
              <div className="mt-3 text-sm leading-relaxed text-stone-600">{section.content}</div>
            </div>
          ))}

          {/* Jouw rechten — scannable card grid */}
          <div className="border-t border-stone-100 pt-8">
            <h2 className="text-lg font-semibold text-stone-900">Jouw rechten</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              Als gebruiker heb je op grond van de AVG de volgende rechten. Je kunt deze uitoefenen via{" "}
              <a href="/contact" className="text-rose-600 underline underline-offset-2 hover:text-rose-700">ons contactformulier</a>. We reageren binnen 5 werkdagen.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rights.map((r) => (
                <div key={r.title} className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/60 px-4 py-3">
                  <RightIcon path={r.icon} />
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{r.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust closing */}
        <div className="mt-12 rounded-2xl border border-stone-100 bg-gradient-to-br from-stone-50 to-white p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50">
              <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-stone-800">Privacy en vertrouwen zijn de basis van Welkthuis</p>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                Welkthuis is gebouwd op vertrouwen. Woeken zoeken is persoonlijk — en jouw gegevens behandelen we dienovereenkomstig. We gebruiken ze alleen om het platform beter te maken voor jou, nooit om je te volgen of te profileren voor commerciële doeleinden.
              </p>
              <p className="mt-2 text-sm text-stone-500">
                Vragen of zorgen? Neem contact op via{" "}
                <a href="/contact" className="text-rose-600 underline underline-offset-2 hover:text-rose-700">het contactformulier</a>. We helpen je graag.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
