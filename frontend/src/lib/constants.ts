import type { ListingType } from "@/types/database";

/** Amsterdamse stadsdelen / veelgebruikte wijken voor filters */
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
] as const;

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
