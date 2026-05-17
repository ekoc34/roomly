import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { canUseAnalytics, CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent";

const LOADER_ID = "plausible-loader";
const INIT_ID = "plausible-init";
const PLAUSIBLE_SRC = "https://plausible.io/js/pa-frb2BXzxfEnW2O9EXaHSj.js";

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

/**
 * Inject the Plausible script unconditionally.
 *
 * Plausible is cookieless — the script itself sends no data and sets no
 * cookies. Only calling window.plausible('pageview') records a visit.
 * Loading the script eagerly (without waiting for consent) is therefore
 * GDPR-safe and is required for Plausible's verification bot to detect it.
 */
function injectScript(): void {
  if (document.getElementById(LOADER_ID)) return;

  // 1. Init snippet — must exist before the loader script executes
  const init = document.createElement("script");
  init.id = INIT_ID;
  init.textContent =
    "window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()";
  document.head.appendChild(init);

  // 2. Async loader
  const loader = document.createElement("script");
  loader.id = LOADER_ID;
  loader.src = PLAUSIBLE_SRC;
  loader.async = true;
  document.head.appendChild(loader);
}

export function PlausibleProvider(): null {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  const [path] = useLocation();
  const prevPathRef = useRef<string | null>(null);

  // Always inject the script as soon as the component mounts — regardless of
  // consent. The script is harmless on its own; no pageview is sent here.
  useEffect(() => {
    if (!domain) return;
    injectScript();
  }, [domain]);

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
      window.plausible("pageview");
    }
  }, [path]);

  // Re-fire a pageview for the current route the moment the user grants
  // analytics consent mid-session (e.g. they accept the cookie banner).
  useEffect(() => {
    function onConsentChange(): void {
      if (canUseAnalytics() && typeof window.plausible === "function") {
        window.plausible("pageview");
      }
    }

    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
  }, []);

  return null;
}
