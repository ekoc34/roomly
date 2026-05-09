import type { ListingType } from "@/types/database";

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_LISTING_TITLE_LENGTH = 72;
export const NEW_LABEL_TODAY_HOURS = 24;
export const NEW_LABEL_RECENT_HOURS = 72;

export const AMSTERDAM_DISTRICTS = [
  "Centrum",
  "Noord",
  "Oost",
  "Zuid",
  "West",
  "Nieuw-West",
  "Zuidoost",
  "Weesp",
  "IJburg",
  "De Pijp",
  "Jordaan",
  "Oud-West",
  "Oostelijk havengebied",
];

export const ROTTERDAM_DISTRICTS = [
  "Centrum",
  "Noord",
  "Zuid",
  "Oost",
  "West",
  "Delfshaven",
  "Feijenoord",
  "Charlois",
  "IJsselmonde",
  "Prins Alexander",
  "Kralingen",
  "Hillegersberg",
];

export const UTRECHT_DISTRICTS = [
  "Binnenstad",
  "Oost",
  "West",
  "Noord",
  "Zuid",
  "Leidsche Rijn",
  "Vleuten-De Meern",
  "Overvecht",
  "Lunetten",
  "Hoograven",
];

export const DEN_HAAG_DISTRICTS = [
  "Centrum",
  "Scheveningen",
  "Laak",
  "Escamp",
  "Loosduinen",
  "Segbroek",
  "Haagse Hout",
  "Leidschenveen-Ypenburg",
];

export const EINDHOVEN_DISTRICTS = [
  "Centrum",
  "Strijp",
  "Woensel",
  "Stratum",
  "Gestel",
  "Tongelre",
];

export const GRONINGEN_DISTRICTS = [
  "Centrum",
  "Oosterparkwijk",
  "Korrewegwijk",
  "De Hunze",
  "Van Starkenborgh",
  "Lewenborg",
  "Beijum",
];

export const MAASTRICHT_DISTRICTS = [
  "Centrum",
  "Wyck",
  "Sint Pieter",
  "Jekerkwartier",
  "Kommelkwartier",
  "Boschpoort",
  "Malberg",
  "Heer",
];

export const LEIDEN_DISTRICTS = [
  "Binnenstad",
  "Noord",
  "Oost",
  "West",
  "Zuid-West",
  "Mors",
  "Stevenshof",
  "Merenwijk",
];

export const DELFT_DISTRICTS = [
  "Binnenstad",
  "Noord",
  "Oost",
  "Zuid",
  "TU-wijk",
  "Voorhof",
  "Tanthof",
];

export const TILBURG_DISTRICTS = [
  "Centrum",
  "Noord",
  "Oost",
  "West",
  "Zuid",
  "Reeshof",
  "Udenhout",
  "Berkel-Enschot",
];

export const BREDA_DISTRICTS = [
  "Centrum",
  "Noord",
  "Oost",
  "West",
  "Zuid",
  "Ulvenhout",
  "Prinsenbeek",
  "Teteringen",
];

export const NIJMEGEN_DISTRICTS = [
  "Centrum",
  "Oost",
  "West",
  "Noord",
  "Zuid",
  "Dukenburg",
  "Lindenholt",
  "Nijmegen-Midden",
];

export const ARNHEM_DISTRICTS = [
  "Centrum",
  "Noord",
  "Oost",
  "West",
  "Zuid",
  "Presikhaaf",
  "Malburgen",
  "Kronenburg",
];

export const HAARLEM_DISTRICTS = [
  "Centrum",
  "Noord",
  "Oost",
  "West",
  "Zuid",
  "Schalkwijk",
  "Haarlem-Noord",
];

export const DEN_BOSCH_DISTRICTS = [
  "Centrum",
  "Noord",
  "Oost",
  "West",
  "Zuid",
  "Rosmalen",
  "Maaspoort",
  "Vinkel",
];

export const CITY_DISTRICTS: Record<string, string[]> = {
  amsterdam: AMSTERDAM_DISTRICTS,
  rotterdam: ROTTERDAM_DISTRICTS,
  utrecht: UTRECHT_DISTRICTS,
  "den haag": DEN_HAAG_DISTRICTS,
  "'s-gravenhage": DEN_HAAG_DISTRICTS,
  eindhoven: EINDHOVEN_DISTRICTS,
  groningen: GRONINGEN_DISTRICTS,
  maastricht: MAASTRICHT_DISTRICTS,
  leiden: LEIDEN_DISTRICTS,
  delft: DELFT_DISTRICTS,
  tilburg: TILBURG_DISTRICTS,
  breda: BREDA_DISTRICTS,
  nijmegen: NIJMEGEN_DISTRICTS,
  arnhem: ARNHEM_DISTRICTS,
  haarlem: HAARLEM_DISTRICTS,
  "'s-hertogenbosch": DEN_BOSCH_DISTRICTS,
  "den bosch": DEN_BOSCH_DISTRICTS,
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  room_for_rent: "Kamer te huur",
  roommate_search: "Mede-huurder gezocht",
  short_stay: "Kort verblijf",
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: "In behandeling",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
};
