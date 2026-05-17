/**
 * PasswordRecoveryHandler — global safety net for hash-based recovery redirects.
 *
 * This component does ONE thing only: if the browser lands anywhere with a
 * recovery hash in the URL and the user is NOT already on /wachtwoord-instellen,
 * it performs a client-side navigation to ResetPasswordPage so the reset page
 * owns the full recovery lifecycle.
 *
 * It does NOT:
 *  - Listen for PASSWORD_RECOVERY events (ResetPasswordPage does this)
 *  - Exchange any tokens (ResetPasswordPage does this)
 *  - Set sessionStorage flags
 *  - Redirect if already on /wachtwoord-instellen
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export function PasswordRecoveryHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    const alreadyOnResetPage = window.location.pathname.includes("wachtwoord-instellen");

    // Only act on hash-based recovery tokens that arrived somewhere unexpected.
    // PKCE (?code=) and token_hash (?token_hash=) flows land directly on
    // /wachtwoord-instellen because ForgotPasswordPage uses redirectTo pointing
    // there, so those never need to be caught here.
    if (
      hash.includes("type=recovery") &&
      hash.includes("access_token=") &&
      !alreadyOnResetPage
    ) {
      // Navigate to reset page; preserve hash so ResetPasswordPage can read it.
      // Using window.location.replace keeps the hash fragment intact across
      // the navigation (wouter setLocation strips hashes).
      window.location.replace("/wachtwoord-instellen" + window.location.search + hash);
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
