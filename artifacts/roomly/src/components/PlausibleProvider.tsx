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

function injectScript(): void {
  if (document.getElementById(LOADER_ID)) return;

  // 1. Init snippet — must exist before the loader script runs
  const init = document.createElement("script");
  init.id = INIT_ID;
  init.textContent =
    "window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()";
  document.head.appendChild(init);

  // 2. Async loader script
  const loader = document.createElement("script");
  loader.id = LOADER_ID;
  loader.src = PLAUSIBLE_SRC;
  loader.async = true;
  document.head.appendChild(loader);
}

function removeScript(): void {
  document.getElementById(LOADER_ID)?.remove();
  document.getElementById(INIT_ID)?.remove();
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
        injectScript();
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
