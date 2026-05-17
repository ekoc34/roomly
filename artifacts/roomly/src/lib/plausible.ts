/**
 * Plausible custom event helpers.
 *
 * Usage:
 *   import { trackEvent } from "@/lib/plausible";
 *   trackEvent("message_sent");
 *   trackEvent("listing_created", { type: "room_for_rent" });
 *
 * Events only fire when window.plausible is available (script loaded) and
 * the user has granted analytics consent — enforced inside PlausibleProvider.
 * These helpers never throw; failure is silent to avoid disrupting the UI.
 *
 * Adding a new event:
 *   1. Add its name to the PlausibleEvent union below.
 *   2. If it carries props, extend PlausibleEventProps with a matching key.
 *   3. Call trackEvent("your_event_name") at the success branch of the action.
 */

type PlausibleEventProps = {
  message_sent:      Record<string, never>;
  // ── add future events here, e.g.: ──────────────────────────────────
  // listing_created: { type: string };
  // application_sent: Record<string, never>;
  // favorite_added:  Record<string, never>;
};

type PlausibleEvent = keyof PlausibleEventProps;

declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void;
  }
}

export function trackEvent<E extends PlausibleEvent>(
  event: E,
  ...args: PlausibleEventProps[E] extends Record<string, never>
    ? []
    : [props: PlausibleEventProps[E]]
): void {
  try {
    if (typeof window.plausible !== "function") return;
    const props = args[0] as Record<string, string | number | boolean> | undefined;
    window.plausible(event, props ? { props } : undefined);
  } catch {
    // Never let analytics errors bubble into the UI
  }
}
