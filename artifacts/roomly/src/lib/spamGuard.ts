// ─────────────────────────────────────────────────────────────────────────────
// Spam & Abuse Detection — Welkthuis.nl
// Lightweight client-side heuristics. No AI, no network calls.
// All pattern matches are case-insensitive.
// ─────────────────────────────────────────────────────────────────────────────

export type SpamCategory =
  | "telegram"
  | "whatsapp"
  | "crypto"
  | "payment_scam"
  | "payment_link"
  | "suspicious_url"
  | "excessive_caps"
  | "repetitive_text";

export type SpamSeverity = "low" | "medium" | "high";

export type SpamResult = {
  isSpam: boolean;
  category: SpamCategory | null;
  severity: SpamSeverity;
};

// ── Patterns ──────────────────────────────────────────────────────────────────

const P_TELEGRAM: RegExp[] = [
  /\bt\.me\/[a-z0-9_]{3,}/i,
  /telegram\.me\//i,
  /tg:\/\//i,
  /telegram\s*(me|dot\s*me|\.me)/i,
  /@[a-z][a-z0-9_]{4,31}\s*(op\s*telegram|via\s*telegram|on\s*telegram)/i,
  /stuur\s*me\s*(op|een|via)\s*telegram/i,
  /contact\s*(me\s*)?on\s*telegram/i,
];

const P_WHATSAPP: RegExp[] = [
  /whatsapp/i,
  /wa\.me\//i,
  /whats\s*app/i,
  /stuur\s*me\s*(een\s*)?app/i,
  /appje\s*sturen/i,
];

const P_CRYPTO: RegExp[] = [
  /\bbitcoin\b/i,
  /\bbtc\b/i,
  /\beth(?:ereum)?\b/i,
  /\busdt\b/i,
  /crypto\s*wallet/i,
  /wallet\s*address/i,
  /send\s*(crypto|coins?|tokens?)/i,
  /betaal\s*(in\s*)?bitcoin/i,
];

const P_PAYMENT_SCAM: RegExp[] = [
  /western\s*union/i,
  /moneygram/i,
  /advance\s*fee/i,
  /betaal\s*vooruit/i,
  /aanbetaling\s*sturen/i,
  /borg.*overmaken.*voor.*bezich/i,
  /pay\s*before\s*(view|visit)/i,
  /transfer\s*money\s*first/i,
  /gift\s*card/i,
  /google\s*pay.*first/i,
  /paypal.*friends?\s*(and\s*family)?/i,
  /send\s*money\s*before/i,
  /stuur\s*geld\s*voordat/i,
  /ik\s*(ben|zit)\s*(in\s*)?(het\s*)?buitenland\s*.*huis/i,
  /sleutel\s*opsturen\s*na\s*betaling/i,
  /geld\s*overmaken\s*(en\s*dan|voordat)/i,
];

const P_PAYMENT_LINKS: RegExp[] = [
  /paypal\.me\//i,
  /revolut\.me\//i,
  /tikkie\.me\//i,
  /cash\.app\//i,
  /venmo\.com\//i,
];

const P_SUSPICIOUS_URLS: RegExp[] = [
  /bit\.ly\//i,
  /tinyurl\.com\//i,
  /goo\.gl\//i,
  /ow\.ly\//i,
  /short\.link\//i,
  /rb\.gy\//i,
  /cutt\.ly\//i,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function hasExcessiveCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 20) return false;
  const caps = text.replace(/[^A-Z]/g, "").length;
  return caps / letters.length > 0.72;
}

function isRepetitiveText(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 8) return false;
  const unique = new Set(words.map((w) => w.toLowerCase()));
  return unique.size / words.length < 0.28; // >72% repeated words = bot-like
}

// ── Public API ────────────────────────────────────────────────────────────────

const CLEAN_RESULT: SpamResult = { isSpam: false, category: null, severity: "low" };

/**
 * Check a chat message body for spam.
 * Returns { isSpam, category, severity }.
 */
export function checkMessageSpam(body: string): SpamResult {
  const t = body.trim();

  if (matchesAny(t, P_PAYMENT_SCAM))
    return { isSpam: true, category: "payment_scam", severity: "high" };

  if (matchesAny(t, P_TELEGRAM))
    return { isSpam: true, category: "telegram", severity: "high" };

  if (matchesAny(t, P_CRYPTO))
    return { isSpam: true, category: "crypto", severity: "high" };

  if (matchesAny(t, P_WHATSAPP))
    return { isSpam: true, category: "whatsapp", severity: "medium" };

  if (matchesAny(t, P_PAYMENT_LINKS))
    return { isSpam: true, category: "payment_link", severity: "medium" };

  if (matchesAny(t, P_SUSPICIOUS_URLS))
    return { isSpam: true, category: "suspicious_url", severity: "low" };

  if (isRepetitiveText(t))
    return { isSpam: true, category: "repetitive_text", severity: "low" };

  return CLEAN_RESULT;
}

/**
 * Check a listing title + description for spam.
 * Low-severity issues (caps, suspicious URL) allow the listing through
 * but flag it for shadow review. High/medium block it.
 */
export function checkListingSpam(title: string, description: string): SpamResult {
  const combined = `${title} ${description}`;

  if (matchesAny(combined, P_PAYMENT_SCAM))
    return { isSpam: true, category: "payment_scam", severity: "high" };

  if (matchesAny(combined, P_CRYPTO))
    return { isSpam: true, category: "crypto", severity: "high" };

  if (matchesAny(combined, P_TELEGRAM))
    return { isSpam: true, category: "telegram", severity: "medium" };

  if (matchesAny(combined, P_SUSPICIOUS_URLS))
    return { isSpam: true, category: "suspicious_url", severity: "medium" };

  if (hasExcessiveCaps(title))
    return { isSpam: true, category: "excessive_caps", severity: "low" };

  if (matchesAny(combined, P_PAYMENT_LINKS))
    return { isSpam: true, category: "payment_link", severity: "low" };

  return CLEAN_RESULT;
}

// ── Dutch error messages ──────────────────────────────────────────────────────

export const SPAM_MESSAGES_NL: Record<SpamCategory, string> = {
  telegram:
    "Berichten met Telegram-links zijn niet toegestaan. Communiceer via het Welkthuis-berichtenplatform.",
  whatsapp:
    "WhatsApp-verwijzingen zijn niet toegestaan. Gebruik het interne berichtensysteem.",
  crypto:
    "Berichten over crypto-betalingen worden geblokkeerd. Gebruik altijd officiële betaalmethoden.",
  payment_scam:
    "Dit bericht bevat kenmerken van een oplichterstruc en is geblokkeerd ter bescherming van onze gebruikers.",
  payment_link:
    "Externe betaallinks zijn niet toegestaan. Gebruik alleen officiële betaalmethoden.",
  suspicious_url:
    "Verkorte of verdachte links zijn niet toegestaan in berichten.",
  excessive_caps:
    "De advertentietitel bevat te veel hoofdletters. Pas de titel aan en probeer opnieuw.",
  repetitive_text:
    "Het bericht bevat te veel herhaalde tekst en is geblokkeerd.",
};

export const SPAM_LISTING_MESSAGES_NL: Record<SpamCategory, string> = {
  ...SPAM_MESSAGES_NL,
  telegram:
    "Beschrijvingen met Telegram-links zijn niet toegestaan.",
  suspicious_url:
    "Verdachte of verkorte links zijn niet toegestaan in advertenties.",
  excessive_caps:
    "De advertentietitel bevat te veel hoofdletters. Gebruik normale hoofdletters.",
};

export function getSpamMessageNL(category: SpamCategory | null, context: "message" | "listing" = "message"): string {
  if (!category) return "De inhoud is geblokkeerd vanwege verdachte patronen.";
  return context === "listing" ? SPAM_LISTING_MESSAGES_NL[category] : SPAM_MESSAGES_NL[category];
}
