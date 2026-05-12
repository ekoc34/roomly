export type RpcErrorCode =
  | "NOT_AUTHENTICATED"
  | "NOT_AUTHORIZED"
  | "INVALID_DATA"
  | "INSUFFICIENT_CREDITS"
  | "COOLDOWN_ACTIVE"
  | "LIMIT_REACHED"
  | "PROFILE_NOT_FOUND"
  | "LISTING_NOT_FOUND"
  | "USER_NOT_FOUND";

const RPC_ERROR_MESSAGES: Record<RpcErrorCode, string> = {
  NOT_AUTHENTICATED:    "Je bent niet ingelogd. Log opnieuw in en probeer het opnieuw.",
  NOT_AUTHORIZED:       "Je hebt geen toegang om deze actie uit te voeren.",
  INVALID_DATA:         "De ingevoerde gegevens zijn ongeldig. Controleer alle velden.",
  INSUFFICIENT_CREDITS: "Je hebt geen boost-credits meer. Koop credits via de Pricing-pagina.",
  COOLDOWN_ACTIVE:      "Je kunt deze advertentie pas over 24 uur opnieuw uitlichten.",
  LIMIT_REACHED:        "Je hebt je gratis limiet van 2 advertenties bereikt. Upgrade naar Premium voor onbeperkte advertenties.",
  PROFILE_NOT_FOUND:    "Profiel niet gevonden.",
  LISTING_NOT_FOUND:    "Advertentie niet gevonden.",
  USER_NOT_FOUND:       "Gebruiker niet gevonden.",
};

const FALLBACK_MESSAGE = "Er is een fout opgetreden. Probeer het opnieuw.";

export function mapRpcError(
  error: { message?: string; code?: string } | null | undefined,
  fallback = FALLBACK_MESSAGE
): string {
  if (!error) return fallback;

  // PGRST202: the RPC function doesn't exist in the schema cache.
  // This means the security-hardening migration hasn't been applied to Supabase yet.
  if (error.code === "PGRST202" || error.message?.includes("Could not find the function")) {
    return "Serverfunctie niet gevonden. Vraag de beheerder om de database-migratie uit te voeren.";
  }

  if (!error.message) return fallback;

  for (const code of Object.keys(RPC_ERROR_MESSAGES) as RpcErrorCode[]) {
    if (error.message.includes(code)) return RPC_ERROR_MESSAGES[code];
  }
  return fallback;
}
