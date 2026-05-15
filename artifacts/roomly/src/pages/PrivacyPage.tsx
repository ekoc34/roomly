import { Helmet } from "react-helmet-async";

const sections = [
  {
    title: "Welke gegevens we verzamelen",
    content: (
      <>
        <p>We verzamelen alleen gegevens die nodig zijn om het platform goed te laten werken. Dit betreft:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Je naam, e-mailadres en wachtwoord bij registratie</li>
          <li>Profielinformatie die je zelf invult (foto, beschrijving, locatie)</li>
          <li>Advertenties en berichten die je verstuurt via het platform</li>
          <li>Verificatiedocumenten als je kiest voor verificatie</li>
          <li>Technische gegevens zoals je IP-adres en browsertype (voor beveiliging)</li>
        </ul>
      </>
    ),
  },
  {
    title: "Waarom we deze gegevens gebruiken",
    content: (
      <>
        <p>Je gegevens gebruiken we uitsluitend voor:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Het aanmaken en beheren van je account</li>
          <li>Het tonen van woningadvertenties en profielen</li>
          <li>Communicatie tussen huurders, verhuurders en huisgenoten</li>
          <li>Beveiliging en fraudepreventie</li>
          <li>Verbetering van het platform op basis van gebruik</li>
        </ul>
        <p className="mt-3">We verkopen je gegevens nooit aan derden en gebruiken ze niet voor advertentiedoeleinden van andere partijen.</p>
      </>
    ),
  },
  {
    title: "Account- en profielgegevens",
    content: (
      <p>
        Je account- en profielgegevens zijn zichtbaar voor andere gebruikers op het platform, afhankelijk van je privacy-instellingen. Je kunt op elk moment je profielfoto, beschrijving en zichtbaarheid aanpassen via je profielpagina. Je e-mailadres is nooit openbaar zichtbaar.
      </p>
    ),
  },
  {
    title: "Advertenties en berichten",
    content: (
      <p>
        Advertenties die je plaatst zijn publiekelijk zichtbaar. Berichten die je verstuurt zijn alleen zichtbaar voor de betrokken partijen. We bewaren berichten om geschillen te kunnen oplossen en om het platform veilig te houden. Berichten worden niet automatisch gedeeld met derden.
      </p>
    ),
  },
  {
    title: "Verificatiegegevens",
    content: (
      <p>
        Als je ervoor kiest je identiteit te verifiëren, verwerken we de geüploade documenten uitsluitend voor dat doel. Verificatiedocumenten worden na verwerking niet langer bewaard dan noodzakelijk. Het verificatiebadge op je profiel geeft anderen vertrouwen, maar de documenten zelf zijn nooit zichtbaar voor andere gebruikers.
      </p>
    ),
  },
  {
    title: "Cookies en analytics",
    content: (
      <p>
        We gebruiken functionele cookies die noodzakelijk zijn voor het werken van het platform. Analytische cookies gebruiken we om te begrijpen hoe het platform wordt gebruikt, zodat we het kunnen verbeteren. Je kunt je cookievoorkeuren op elk moment aanpassen. Zie onze <a href="/cookies" className="text-rose-600 underline underline-offset-2 hover:text-rose-700">cookiepagina</a> voor meer informatie.
      </p>
    ),
  },
  {
    title: "Hoe lang gegevens worden bewaard",
    content: (
      <>
        <p>We bewaren je gegevens zolang je account actief is. Als je je account verwijdert:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Wordt je profiel en advertentiegeschiedenis verwijderd</li>
          <li>Worden berichten geanonimiseerd of verwijderd</li>
          <li>Kunnen wettelijk verplichte gegevens maximaal 7 jaar worden bewaard</li>
        </ul>
      </>
    ),
  },
  {
    title: "Wanneer gegevens worden gedeeld",
    content: (
      <>
        <p>We delen je gegevens alleen in de volgende situaties:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Met andere gebruikers, voor zover nodig voor de dienst (bijv. contactberichten)</li>
          <li>Met technische dienstverleners die ons helpen het platform te draaien (zoals hostingproviders)</li>
          <li>Als dat wettelijk verplicht is (bijv. bij een rechtmatig verzoek van een autoriteit)</li>
        </ul>
        <p className="mt-3">We sluiten verwerkersovereenkomsten af met alle partijen die namens ons gegevens verwerken.</p>
      </>
    ),
  },
  {
    title: "Jouw rechten",
    content: (
      <>
        <p>Als gebruiker heb je het recht om:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Je persoonsgegevens in te zien</li>
          <li>Onjuiste gegevens te laten corrigeren</li>
          <li>Je gegevens te laten verwijderen</li>
          <li>Bezwaar te maken tegen bepaalde verwerkingen</li>
          <li>Je gegevens over te dragen naar een andere dienst (dataportabiliteit)</li>
        </ul>
        <p className="mt-3">Je kunt deze rechten uitoefenen door contact met ons op te nemen via het contactformulier.</p>
      </>
    ),
  },
  {
    title: "Contact",
    content: (
      <p>
        Heb je vragen over je privacy of over hoe we met je gegevens omgaan? Neem dan contact met ons op via <a href="/contact" className="text-rose-600 underline underline-offset-2 hover:text-rose-700">het contactformulier</a>. We reageren binnen 5 werkdagen.
      </p>
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
        </div>

        <div className="mt-12 rounded-2xl bg-stone-50 p-6 text-sm text-stone-500">
          <p className="font-medium text-stone-700">Vragen over je privacy?</p>
          <p className="mt-1">Neem contact met ons op via <a href="/contact" className="text-rose-600 hover:underline">het contactformulier</a>. We helpen je graag.</p>
        </div>
      </div>
    </>
  );
}
