import type { ListingType } from "@/types/database";

/** Maximum length of a chat message body (chars). Mirrored in DB constraint. */
export const MAX_MESSAGE_LENGTH = 4000;

/** Maximum visual title length cap on listing cards (used for truncation hints). */
export const MAX_LISTING_TITLE_LENGTH = 72;

/** Hours window in which a listing is labelled "Nieuw vandaag" / "Nieuw" on cards. */
export const NEW_LABEL_TODAY_HOURS = 24;
export const NEW_LABEL_RECENT_HOURS = 72;

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
