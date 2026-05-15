import { Helmet } from "react-helmet-async";

const sections = [
  {
    title: "Gebruik van het platform",
    content: (
      <>
        <p>Welkthuis is een platform waarop huurders, verhuurders en huisgenoten elkaar kunnen vinden. Door gebruik te maken van het platform ga je akkoord met deze voorwaarden. Je mag het platform alleen gebruiken voor legitieme woonzoekopdrachten en het plaatsen van eerlijke advertenties.</p>
      </>
    ),
  },
  {
    title: "Accounts en verantwoordelijkheid",
    content: (
      <>
        <p>Je bent zelf verantwoordelijk voor de informatie die je op je profiel plaatst. Houd je accountgegevens veilig en deel je wachtwoord nooit. Je bent aansprakelijk voor alle activiteiten die via jouw account plaatsvinden.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Je mag slechts één account aanmaken</li>
          <li>Je accountgegevens moeten correct en actueel zijn</li>
          <li>Je bent verantwoordelijk voor vertrouwelijkheid van je inloggegevens</li>
        </ul>
      </>
    ),
  },
  {
    title: "Advertenties plaatsen",
    content: (
      <>
        <p>Als je een advertentie plaatst, ga je ermee akkoord dat:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>De informatie volledig en waarheidsgetrouw is</li>
          <li>De foto's de werkelijke situatie weergeven</li>
          <li>De prijs en voorwaarden kloppen zoals beschreven</li>
          <li>Je het recht hebt om de woning of kamer aan te bieden</li>
          <li>Nep-advertenties of advertenties puur als lokaas niet zijn toegestaan</li>
        </ul>
      </>
    ),
  },
  {
    title: "Huisregels en verboden gedrag",
    content: (
      <>
        <p>Op Welkthuis hanteren we een simpele regel: behandel anderen zoals je zelf behandeld wilt worden. Het volgende gedrag is niet toegestaan:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Discriminatie op basis van afkomst, religie, geslacht of andere kenmerken</li>
          <li>Intimidatie, bedreigingen of pestgedrag</li>
          <li>Het verspreiden van valse informatie over woningen of personen</li>
          <li>Het misbruiken van het berichtensysteem voor commerciële doeleinden</li>
          <li>Het omzeilen van het platform voor betalingen buiten Welkthuis om</li>
        </ul>
      </>
    ),
  },
  {
    title: "Spam en misbruik",
    content: (
      <p>
        Het versturen van ongewenste berichten, het automatisch aanmaken van accounts of het gebruik van bots is verboden. We behouden ons het recht voor om accounts die dit gedrag vertonen direct te blokkeren, zonder voorafgaande waarschuwing.
      </p>
    ),
  },
  {
    title: "Verificatie en vertrouwen",
    content: (
      <p>
        Verificatie is vrijwillig maar wordt sterk aanbevolen. Een geverifieerd profiel vergroot het vertrouwen van andere gebruikers. Welkthuis staat niet garant voor de juistheid van geverifieerde informatie, maar doet redelijke inspanningen om de verificatieprocessen betrouwbaar te houden.
      </p>
    ),
  },
  {
    title: "Betalingen en boosts",
    content: (
      <>
        <p>Sommige functies op Welkthuis zijn betaald, zoals het boosten van advertenties. Voor betaalde diensten gelden de volgende regels:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Betalingen worden verwerkt via een veilige betaalprovider</li>
          <li>Boosts zijn persoonsgebonden en niet overdraagbaar</li>
          <li>Terugbetalingen zijn alleen mogelijk als de dienst aantoonbaar niet is geleverd</li>
          <li>We behouden ons het recht voor om prijzen te wijzigen, met voorafgaande kennisgeving</li>
        </ul>
      </>
    ),
  },
  {
    title: "Aansprakelijkheid",
    content: (
      <p>
        Welkthuis is een tussenpersoon en is niet aansprakelijk voor transacties, afspraken of geschillen tussen gebruikers onderling. We doen ons best om het platform veilig en betrouwbaar te houden, maar kunnen niet garanderen dat alle informatie op het platform volledig juist is. Gebruik het platform op eigen risico.
      </p>
    ),
  },
  {
    title: "Moderatie en accountbeperkingen",
    content: (
      <p>
        We behouden ons het recht voor om advertenties te verwijderen, berichten te modereren of accounts te beperken als dat nodig is om de veiligheid en integriteit van het platform te waarborgen. We doen dit proportioneel en proberen gebruikers waar mogelijk eerst te waarschuwen.
      </p>
    ),
  },
  {
    title: "Wijzigingen aan het platform",
    content: (
      <p>
        We kunnen deze voorwaarden van tijd tot tijd aanpassen. Bij belangrijke wijzigingen ontvang je een melding via e-mail of via het platform. Door het platform te blijven gebruiken na een wijziging, ga je akkoord met de nieuwe voorwaarden.
      </p>
    ),
  },
  {
    title: "Contact",
    content: (
      <p>
        Heb je vragen over deze voorwaarden? Neem dan contact met ons op via <a href="/contact" className="text-rose-600 underline underline-offset-2 hover:text-rose-700">het contactformulier</a>.
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
            Deze voorwaarden gelden voor iedereen die Welkthuis gebruikt. We hebben ze zo duidelijk mogelijk opgeschreven — geen juridisch jargon waar dat niet nodig is.
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
          <p className="font-medium text-stone-700">Vragen over de voorwaarden?</p>
          <p className="mt-1">Neem contact met ons op via <a href="/contact" className="text-rose-600 hover:underline">het contactformulier</a>. We helpen je graag.</p>
        </div>
      </div>
    </>
  );
}
