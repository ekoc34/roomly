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
