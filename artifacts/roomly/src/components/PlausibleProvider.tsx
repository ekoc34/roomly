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
  delete window.plausible;
}

export function PlausibleProvider(): null {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  const [path] = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!domain) return;

    function syncScript(): void {
      if (canUseAnalytics()) {
        injectScript(domain as string);
      } else {
        removeScript();
      }
    }

    syncScript();

    window.addEventListener(CONSENT_CHANGED_EVENT, syncScript);
    window.addEventListener("storage", syncScript);

    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, syncScript);
      window.removeEventListener("storage", syncScript);
    };
  }, [domain]);

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

  return null;
}
