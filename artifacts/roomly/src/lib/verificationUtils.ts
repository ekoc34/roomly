import type { Profile } from "@/types/database";

export function isFullyVerified(profile: Profile | null | undefined): boolean {
  return profile?.email_auto_verified === true && profile?.phone_verified === true;
}

export function isPartiallyVerified(profile: Profile | null | undefined): boolean {
  return (
    !isFullyVerified(profile) &&
    !!(profile?.email_auto_verified || profile?.phone_verified)
  );
}
