/**
 * Single source of truth for user verification state.
 *
 * RULE: a user is "fully verified" when BOTH of the following are true:
 *   1. Their email is confirmed  — checked via user.email_confirmed_at when the
 *      Supabase auth User object is available (own profile), or via the
 *      profile.email_auto_verified column as a proxy when viewing another user.
 *   2. Their phone has been verified — profile.phone_verified === true.
 *
 * Do NOT infer verification from:
 *   - OAuth login alone
 *   - premium / subscription tier
 *   - profile completion / onboarding
 *   - phone number existing (without OTP confirmation)
 *   - an active auth session
 */
import type { User } from "@supabase/supabase-js";

export type VerifiableProfile = {
  email_auto_verified?: boolean | null;
  phone_verified?: boolean | null;
} | null | undefined;

function resolveEmail(
  user: User | null | undefined,
  profile: VerifiableProfile,
): boolean {
  if (user) {
    return Boolean(user.email_confirmed_at);
  }
  return Boolean(profile?.email_auto_verified);
}

function resolvePhone(profile: VerifiableProfile): boolean {
  return profile?.phone_verified === true;
}

export function isFullyVerified(
  user: User | null | undefined,
  profile: VerifiableProfile,
): boolean {
  const emailConfirmed = resolveEmail(user, profile);
  const phoneVerified  = resolvePhone(profile);
  const result         = emailConfirmed && phoneVerified;

  console.log(
    "[verification]",
    "email_confirmed_at:", user ? (user.email_confirmed_at ?? null) : "(proxy: email_auto_verified=" + String(profile?.email_auto_verified) + ")",
    "| phone_verified:", profile?.phone_verified ?? null,
    "| isFullyVerified:", result,
  );

  return result;
}

export function isPartiallyVerified(
  user: User | null | undefined,
  profile: VerifiableProfile,
): boolean {
  const emailConfirmed = resolveEmail(user, profile);
  const phoneVerified  = resolvePhone(profile);
  if (emailConfirmed && phoneVerified) return false;
  return emailConfirmed || phoneVerified;
}
