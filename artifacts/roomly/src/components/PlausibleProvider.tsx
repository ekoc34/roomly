import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { canUseAnalytics, CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent";

const LOADER_ID = "plausible-loader";
const QUEUE_ID = "plausible-queue";
const PLAUSIBLE_SRC = "https://plausible.io/js/pa-frb2BXzxfEnW2O9EXaHSj.js";

declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void;
  }
}

function injectScript(domain: string): void {
  if (document.getElementById(LOADER_ID)) return;

  // 1. Queue shim — must exist before the loader script runs
  const queue = document.createElement("script");
  queue.id = QUEUE_ID;
  queue.textContent =
    "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};";
  document.head.appendChild(queue);

  // 2. Loader script — official Plausible snippet
  const loader = document.createElement("script");
  loader.id = LOADER_ID;
  loader.src = PLAUSIBLE_SRC;
  loader.async = true;
  loader.setAttribute("data-domain", domain);
  document.head.appendChild(loader);
}

function removeScript(): void {
  document.getElementById(LOADER_ID)?.remove();
  document.getElementById(QUEUE_ID)?.remove();
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
