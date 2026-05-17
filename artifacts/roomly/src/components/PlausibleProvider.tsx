import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { canUseAnalytics, CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent";

const SCRIPT_ID = "plausible-analytics";
const PLAUSIBLE_SRC = "https://plausible.io/js/script.js";

declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void;
  }
}

function injectScript(domain: string): void {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = PLAUSIBLE_SRC;
  script.defer = true;
  script.setAttribute("data-domain", domain);
  document.head.appendChild(script);
}

function removeScript(): void {
  document.getElementById(SCRIPT_ID)?.remove();
  // Clear the queued function Plausible may have attached to window
  // so stale events don't fire after the user revokes consent
  delete window.plausible;
}

export function PlausibleProvider(): null {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  const [path] = useLocation();
  const prevPathRef = useRef<string | null>(null);

  // Inject or remove the script whenever consent changes
  useEffect(() => {
    if (!domain) return;

    function syncScript(): void {
      if (canUseAnalytics()) {
        injectScript(domain as string);
      } else {
        removeScript();
      }
    }

    // Run immediately on mount (handles page load and hot-reload)
    syncScript();

    // Same-tab consent changes (banner / preferences page)
    window.addEventListener(CONSENT_CHANGED_EVENT, syncScript);
    // Cross-tab consent changes via localStorage
    window.addEventListener("storage", syncScript);

    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, syncScript);
      window.removeEventListener("storage", syncScript);
    };
  }, [domain]);

  // Track page views on every route change
  useEffect(() => {
    // Skip the very first render — Plausible auto-fires on initial script load
    if (prevPathRef.current === null) {
      prevPathRef.current = path;
      return;
    }
    // Only fire when the path actually changed
    if (prevPathRef.current === path) return;
    prevPathRef.current = path;

    if (canUseAnalytics() && typeof window.plausible === "function") {
      window.plausible("pageview");
    }
  }, [path]);

  return null;
}
