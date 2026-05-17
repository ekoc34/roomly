export const CONSENT_STORAGE_KEY = "welkthuis_cookie_consent";
export const CONSENT_VERSION = 1;
export const CONSENT_CHANGED_EVENT = "welkthuis:consent-changed";

export type CookieConsentPrefs = {
  version: number;
  granted_at: string;
  noodzakelijk: true;
  analytisch: boolean;
  marketing: boolean;
};

export function getConsent(): CookieConsentPrefs | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentPrefs;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setConsent(prefs: { analytisch: boolean; marketing: boolean }): CookieConsentPrefs {
  const consent: CookieConsentPrefs = {
    version: CONSENT_VERSION,
    granted_at: new Date().toISOString(),
    noodzakelijk: true,
    analytisch: prefs.analytisch,
    marketing: prefs.marketing,
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // localStorage unavailable (private browsing edge-case) — fail silently
  }
  // Notify same-tab listeners (storage event only fires in other tabs)
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
  } catch {
    // non-browser environment — fail silently
  }
  return consent;
}

export function hasConsented(): boolean {
  return getConsent() !== null;
}

export function canUseAnalytics(): boolean {
  return getConsent()?.analytisch === true;
}

export function canUseMarketing(): boolean {
  return getConsent()?.marketing === true;
}
