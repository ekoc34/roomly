import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { canUseAnalytics, CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent";

// The Plausible loader and init snippet are injected statically in index.html
// so they appear in the raw HTML response — detectable by bots/crawlers without
// JS execution. This component is responsible ONLY for consent-gated pageview events.

declare global {
  interface Window {
    plausible?: ((
      eventName: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void) & {
      q?: unknown[];
      init?: (i?: unknown) => void;
      o?: unknown;
    };
  }
}

export function PlausibleProvider(): null {
  console.log("[Plausible] PlausibleProvider render (component is alive)");

  const [path] = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const loaderEl = document.querySelector('script[src*="plausible.io"]');
    console.log(
      "[Plausible] mount effect fired — loader script in DOM:",
      !!loaderEl,
      "| window.plausible:", typeof window.plausible
    );
  }, []);

  // SPA route tracking — fires a pageview only when the user has granted
  // analytics consent. This is the sole point where data is actually sent.
  useEffect(() => {
    if (prevPathRef.current === null) {
      prevPathRef.current = path;
      return;
    }
    if (prevPathRef.current === path) return;
    prevPathRef.current = path;

    if (canUseAnalytics() && typeof window.plausible === "function") {
      console.log("[Plausible] firing pageview for path:", path);
      window.plausible("pageview");
    }
  }, [path]);

  // Re-fire a pageview for the current route the moment the user grants
  // analytics consent mid-session (e.g. they accept the cookie banner).
  useEffect(() => {
    function onConsentChange(): void {
      if (canUseAnalytics() && typeof window.plausible === "function") {
        console.log("[Plausible] consent granted — firing pageview for current route");
        window.plausible("pageview");
      }
    }

    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
  }, []);

  return null;
}
