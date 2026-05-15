import { Helmet } from "react-helmet-async";

const sections = [
  {
    title: "Wat is Welkthuis?",
    content: (
      <>
        <p>
          Welkthuis is een platform waarop huurders, verhuurders en huisgenoten elkaar kunnen vinden. We zijn een tussenpersoon — we faciliteren contact en communicatie, maar we zijn geen partij bij de huurovereenkomsten of andere afspraken die via het platform tot stand komen.
        </p>
        <p className="mt-2">
          Door gebruik te maken van het platform ga je akkoord met deze voorwaarden. Je mag het platform alleen gebruiken voor eerlijke woonzoekopdrachten en het plaatsen van oprechte advertenties.
        </p>
      </>
    ),
  },
  {
    title: "Accounts en verantwoordelijkheid",
    content: (
      <>
        <p>Je bent zelf verantwoordelijk voor de informatie op je profiel en voor alle activiteiten die via jouw account plaatsvinden. Houd je inloggegevens veilig en deel je wachtwoord nooit.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Je mag slechts één account aanmaken per persoon</li>
          <li>Je accountgegevens moeten correct en actueel zijn</li>
          <li>Je bent zelf verantwoordelijk voor de vertrouwelijkheid van je inloggegevens</li>
          <li>Bij vermoed misbruik van je account raden we aan dit direct te melden</li>
        </ul>
      </>
    ),
  },
  {
    title: "Advertenties plaatsen",
    content: (
      <>
        <p>Als je een advertentie plaatst, bevestig je dat:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>De informatie volledig en naar waarheid is</li>
          <li>De foto's de werkelijke situatie weergeven</li>
          <li>De prijs en voorwaarden kloppen zoals beschreven</li>
          <li>Je het recht hebt om de woning of kamer aan te bieden</li>
          <li>De advertentie geen misleidende of lokaas-bedoeling heeft</li>
        </ul>
        <p className="mt-3 text-stone-500">Advertenties die niet aan deze eisen voldoen kunnen worden verwijderd. Bij structureel misbruik kan een account worden beperkt.</p>
      </>
    ),
  },
  {
    title: "Gedrag op het platform",
    content: (
      <>
        <p>Op Welkthuis hanteren we een eenvoudige regel: behandel anderen zoals je zelf behandeld wilt worden. Het volgende gedrag is niet toegestaan:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Discriminatie op basis van afkomst, religie, geslacht, leeftijd of andere kenmerken</li>
          <li>Intimidatie, bedreigingen of pesterijen via berichten of reacties</li>
          <li>Het verspreiden van aantoonbaar onjuiste informatie over woningen of personen</li>
          <li>Het misbruiken van het berichtensysteem voor commerciële doeleinden of spam</li>
          <li>Het bewust omzeilen van het platform voor afspraken buiten Welkthuis om</li>
        </ul>
      </>
    ),
  },
  {
    title: "Spam en geautomatiseerd gebruik",
    content: (
      <>
        <p>Het versturen van ongewenste berichten, het automatisch aanmaken van accounts of het gebruik van bots of geautomatiseerde scripts is niet toegestaan. Dit beschadigt de ervaring voor alle gebruikers.</p>
        <p className="mt-2">We detecteren dergelijk gedrag actief. Bij geconstateerd misbruik behouden we ons het recht voor om accounts direct te beperken of te verwijderen. We proberen je waar mogelijk eerst te waarschuwen, maar bij duidelijk structureel misbruik is directe actie gerechtvaardigd.</p>
      </>
    ),
  },
  {
    title: "Verificatie en vertrouwen",
    content: (
      <>
        <p>Verificatie is vrijwillig, maar wordt sterk aanbevolen. Een geverifieerd profiel vergroot het vertrouwen van andere gebruikers en vergroot je kans op reacties.</p>
        <p className="mt-2">Welkthuis doet redelijke inspanningen om verificatieprocessen betrouwbaar te houden, maar staat niet in voor de absolute juistheid van geverifieerde informatie. Verificatie verhoogt vertrouwen — het is geen garantie.</p>
      </>
    ),
  },
  {
    title: "Betaalde functies en boosts",
    content: (
      <>
        <p>Sommige functies op Welkthuis zijn betaald, zoals het boosten van advertenties. Een boost zorgt ervoor dat je advertentie prominenter zichtbaar is voor andere gebruikers.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Betalingen worden verwerkt via een beveiligde betaalprovider (iDEAL)</li>
          <li>Boostkredieten zijn persoonsgebonden en niet overdraagbaar</li>
          <li>Krediet dat niet is verbruikt vervalt niet automatisch, maar heeft geen geldwaarde</li>
          <li>Terugbetalingen zijn alleen mogelijk als de dienst aantoonbaar niet is geleverd</li>
          <li>We behouden ons het recht voor om prijzen aan te passen, met voorafgaande kennisgeving</li>
        </ul>
        <p className="mt-3 text-stone-500">Vragen over een betaling? Neem contact op via het contactformulier.</p>
      </>
    ),
  },
  {
    title: "Aansprakelijkheid",
    content: (
      <>
        <p>
          Welkthuis is een platform en tussenpersoon. We zijn niet betrokken bij de inhoud van advertenties, de afspraken tussen huurders en verhuurders, of de uitkomst van contacten via ons platform. Gebruikers zijn zelf verantwoordelijk voor de afspraken die ze maken.
        </p>
        <p className="mt-2">
          We doen ons best om het platform veilig, betrouwbaar en vrij van fraude te houden — maar kunnen niet garanderen dat alle informatie op het platform volledig en juist is. Raadpleeg bij twijfel altijd aanvullende bronnen en vertrouw op je eigen oordeel.
        </p>
      </>
    ),
  },
  {
    title: "Moderatie en accountbeperkingen",
    content: (
      <>
        <p>We behouden ons het recht voor om advertenties te verwijderen, berichten te modereren of accounts te beperken wanneer dat nodig is om de veiligheid en kwaliteit van het platform te waarborgen.</p>
        <p className="mt-2">We handelen hierbij proportioneel:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Bij kleine overtredingen proberen we je eerst te waarschuwen</li>
          <li>Bij ernstig of herhaald misbruik kan een account direct worden beperkt of verwijderd</li>
          <li>Bij discriminatie of intimidatie handelen we direct en zonder voorafgaande waarschuwing</li>
        </ul>
      </>
    ),
  },
  {
    title: "Wijzigingen aan de voorwaarden",
    content: (
      <p>
        We kunnen deze voorwaarden van tijd tot tijd aanpassen. Bij wezenlijke wijzigingen ontvang je een melding via e-mail of via het platform. Door het platform te blijven gebruiken na een wijziging ga je akkoord met de bijgewerkte voorwaarden. We bewaren eerdere versies op verzoek.
      </p>
    ),
  },
  {
    title: "Contact",
    content: (
      <p>
        Heb je vragen over deze voorwaarden of wil je een situatie melden? Neem contact met ons op via{" "}
        <a href="/contact" className="text-rose-600 underline underline-offset-2 hover:text-rose-700">het contactformulier</a>. We reageren binnen 5 werkdagen.
      </p>
    ),
  },
];

export function VoorwaardenPage() {
  return (
    <>
      <Helmet>
        <title>Algemene voorwaarden — Welkthuis.nl</title>
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Juridisch</p>
          <h1 className="mt-2 text-3xl font-black text-stone-900 sm:text-4xl">Algemene voorwaarden</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-500">
            Deze voorwaarden gelden voor iedereen die Welkthuis gebruikt. We hebben ze zo duidelijk mogelijk opgeschreven — geen onnodig jargon, geen verborgen kleine lettertjes.
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

        <div className="mt-12 rounded-2xl border border-stone-100 bg-stone-50 p-6">
          <p className="font-semibold text-stone-800">Vragen over de voorwaarden?</p>
          <p className="mt-1.5 text-sm text-stone-500">
            Neem contact met ons op via{" "}
            <a href="/contact" className="text-rose-600 hover:underline">het contactformulier</a>. We helpen je graag en reageren binnen 5 werkdagen.
          </p>
        </div>
      </div>
    </>
  );
}
