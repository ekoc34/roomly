import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

export function Footer() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user || !supabase) { setProfile(null); return; }
    supabase.from("profiles").select("user_type").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile | null);
    });
  }, [user]);

  const canPost = profile?.user_type === "verhuurder" || profile?.user_type === "huisgenoot_zoeker";

  return (
    <footer className="mt-auto border-t border-stone-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-3">

          {/* Brand block */}
          <div className="sm:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Welkthuis logo" className="h-10 w-10" />
              <p className="text-xl tracking-tight">
                <span className="font-semibold text-rose-500">Welkthuis</span><span className="font-normal text-rose-500">.nl</span>
              </p>
            </div>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Ontdekken */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t("footer.explore")}</p>
            <nav className="mt-3 flex flex-col gap-2.5 text-sm text-stone-600">
              <Link href="/kamers" className="hover:text-rose-600">{t("footer.searchListings")}</Link>
              {canPost && (
                <Link href="/kamers/nieuw" className="hover:text-rose-600">{t("footer.postListing")}</Link>
              )}
              <Link href="/contact" className="hover:text-rose-600">{t("footer.contact")}</Link>
            </nav>
          </div>

          {/* Account */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t("footer.account")}</p>
            <nav className="mt-3 flex flex-col gap-2.5 text-sm text-stone-600">
              {user ? (
                <>
                  <Link href="/dashboard" className="hover:text-rose-600">{t("footer.dashboard")}</Link>
                  <Link href="/favorieten" className="hover:text-rose-600">{t("footer.favorites")}</Link>
                  <Link href="/berichten" className="hover:text-rose-600">{t("footer.messages")}</Link>
                  <Link href="/profiel" className="hover:text-rose-600">{t("footer.profile")}</Link>
                </>
              ) : (
                <>
                  <Link href="/inloggen" className="hover:text-rose-600">{t("footer.login")}</Link>
                  <Link href="/registreren" className="hover:text-rose-600">{t("footer.register")}</Link>
                </>
              )}
            </nav>
          </div>

        </div>
      </div>

      <div className="border-t border-stone-100 bg-stone-50/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px)+3.5rem)] pt-4 text-center text-xs text-stone-400 md:pb-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          <Link href="/privacy" className="hover:text-stone-600">{t("footer.privacy")}</Link>
          <span className="text-stone-500">·</span>
          <Link href="/voorwaarden" className="hover:text-stone-600">{t("footer.terms")}</Link>
          <span className="text-stone-500">·</span>
          <Link href="/cookies" className="hover:text-stone-600">{t("footer.cookies")}</Link>
          <span className="text-stone-500">·</span>
          <Link href="/cookievoorkeuren" className="hover:text-stone-600">{t("footer.cookiePreferences")}</Link>
        </div>
        <p className="mt-2">{t("footer.madeFor")}.</p>
        <p className="mt-0.5">{t("footer.copyright").replace("{year}", "2026")}</p>
      </div>
    </footer>
  );
}
