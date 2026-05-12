import { loadStripe } from "@stripe/stripe-js";

/*
 * ── HOW TO SET UP YOUR STRIPE TEST KEY ───────────────────────────────────────
 *
 * 1. Log in to https://dashboard.stripe.com/test/apikeys
 * 2. Copy the "Publishable key" that starts with  pk_test_
 * 3. In Replit, open the Secrets panel (padlock icon) and create:
 *      Name:   VITE_STRIPE_PUBLISHABLE_KEY
 *      Value:  pk_test_YOUR_KEY_HERE
 * 4. Restart the dev server.
 *
 * Also add these secrets for the Edge Functions:
 *      STRIPE_SECRET_KEY      →  sk_test_YOUR_SECRET_HERE
 *      STRIPE_WEBHOOK_SECRET  →  whsec_YOUR_WEBHOOK_SECRET_HERE
 *                                (Stripe Dashboard › Developers › Webhooks › Signing secret)
 *      APP_URL                →  https://your-replit-app-url (no trailing slash)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const publishableKey =
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ??
  "pk_test_placeholder";

export const stripePromise = loadStripe(publishableKey);
