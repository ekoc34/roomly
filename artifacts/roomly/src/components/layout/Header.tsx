import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Building2, Map, LogIn, Heart, MessageSquare, Bell, LayoutDashboard, Plus, LogOut, Scale, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useNotifications } from "@/hooks/useNotifications";
import { useCompare } from "@/contexts/CompareContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CitySelector } from "@/components/search/CitySelector";
import { AdminNotificationBell } from "@/components/layout/AdminNotificationBell";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

function getUserTypeLabel(userType: string | null, t: (k: string) => string): string {
  const map: Record<string, string> = {
    verhuurder:        "Verhuurder",
    huisgenoot_zoeker: "Huisgenoot zoeker",
    student:           "Student",
    professional:      "Professional",
    alleenstaande:     "Alleenstaande",
    family:            "Familie",
  };
  return userType ? (map[userType] ?? userType) : t("nav.user");
}

function navCls(active: boolean) {
  return `flex items-center gap-1.5 border-b-2 pb-0.5 transition ${
    active
      ? "border-rose-500 text-rose-500"
      : "border-transparent text-stone-600 hover:text-rose-600"
  }`;
}

function iconCls(active: boolean) {
  return `h-4 w-4 ${active ? "text-rose-500" : "text-stone-400"}`;
}

function getInitial(name: string | null, email: string | null): string {
  const src = name?.trim() || email?.trim() || "?";
  return src.charAt(0).toUpperCase();
}

export function Header() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const { unreadCount: unreadNotifCount } = useNotifications();
  const { compareIds } = useCompare();
  const { t } = useLanguage();
  const [path, navigate] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [boostCredits, setBoostCredits] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);

  const isKamers = path === "/kamers" || (path.startsWith("/kamers/") && path !== "/kamers/nieuw");
  const isKaart  = path === "/kaart";

  const handleSignOut = async () => {
    setDropdownOpen(false);
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from("profiles")
      .select("avatar_url, name, role, user_type, boost_credits")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url ?? null);
          setDisplayName(data.name ?? null);
          setUserRole(data.role ?? null);
          setUserType(data.user_type ?? null);
          setBoostCredits(data.boost_credits ?? null);
        }
      });
  }, [user]);

  const showImg = !!avatarUrl && !imgError;
  const initial = getInitial(displayName, user?.email ?? null);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" data-testid="header-logo" className="flex items-center gap-2 text-xl tracking-tight">
          <img src="/logo.svg" alt="Welkthuis logo" className="h-8 w-8" />
          <span className="font-semibold text-rose-500">Welkthuis<span className="font-normal text-rose-500">.nl</span></span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
          <Link href="/kamers" data-testid="header-kamers-link" className={navCls(isKamers)}>
            <Building2 className={iconCls(isKamers)} />
            {t("nav.listings")}
          </Link>
          <Link href="/kaart" data-testid="header-kaart-link" className={navCls(isKaart)}>
            <Map className={iconCls(isKaart)} />
            {t("nav.map")}
          </Link>
          <CitySelector />

          {compareIds.length > 0 && (
            <Link
              href={`/vergelijk?ids=${compareIds.join(",")}`}
              className="hidden items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100 md:flex"
            >
              <Scale className="h-4 w-4" />
              {t("nav.compareCount").replace("{count}", String(compareIds.length))}
            </Link>
          )}

          {/* Language switcher */}
          <LanguageSwitcher />

          {user ? (
            <>
            {/* Admin notification bell — only visible to admins */}
            <AdminNotificationBell isAdmin={userRole === "admin"} />

            {/* Profile dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                data-testid="header-profile-button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-white transition hover:ring-rose-300"
              >
                {showImg ? (
                  <img
                    src={avatarUrl!}
                    alt={displayName ?? t("nav.user")}
                    onError={() => setImgError(true)}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white transition hover:ring-rose-300"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-600 ring-2 ring-white transition hover:ring-rose-300 select-none">
                    {initial}
                  </span>
                )}
                {unreadCount !== null && unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-stone-200 bg-white py-2 shadow-xl shadow-stone-200/60">

                  {/* ── User info ───────────────────────────────── */}
                  <div className="px-4 py-3 border-b border-stone-100">
                    <p className="font-semibold text-sm text-stone-900 truncate leading-snug">
                      {displayName ?? t("nav.user")}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs text-stone-500">
                        {userRole === "admin"
                          ? t("nav.administrator")
                          : getUserTypeLabel(userType, t)}
                      </span>
                    </span>
                  </div>

                  {/* ── Boost credits ───────────────────────────── */}
                  {boostCredits !== null && (userRole === "admin" || userType === "verhuurder" || userType === "huisgenoot_zoeker") && (
                    <Link
                      href="/pricing"
                      onClick={() => setDropdownOpen(false)}
                      className="mx-3 mt-2 mb-1 flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 transition hover:bg-amber-100"
                    >
                      <span className="text-base leading-none">🚀</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-800 leading-snug">
                          {t("nav.boostsAvailable").replace("{count}", String(boostCredits))}
                        </p>
                        <p className="text-[10px] text-amber-600 mt-0.5 leading-tight">{t("nav.buyMoreCredits")}</p>
                      </div>
                    </Link>
                  )}

                  <div className="mt-1 border-t border-stone-100" />

                  {/* ── Social ──────────────────────────────────── */}
                  <Link
                    href="/favorieten"
                    data-testid="header-favorites-link"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <Heart className="h-4 w-4 text-stone-400" />
                    {t("nav.favorites")}
                  </Link>
                  <Link
                    href="/berichten"
                    data-testid="header-messages-link"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <MessageSquare className="h-4 w-4 text-stone-400" />
                    {t("nav.messages")}
                    {unreadCount !== null && unreadCount > 0 && (
                      <span
                        data-testid="header-unread-badge"
                        className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/notificaties"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <Bell className="h-4 w-4 text-stone-400" />
                    {t("nav.notifications")}
                    {unreadNotifCount > 0 && (
                      <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                      </span>
                    )}
                  </Link>

                  <div className="my-1.5 border-t border-stone-100" />

                  {/* ── Main actions ────────────────────────────── */}
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <LayoutDashboard className="h-4 w-4 text-stone-400" />
                    {t("nav.dashboard")}
                  </Link>
                  {(userType === "verhuurder" || userType === "huisgenoot_zoeker") && (
                    <div className="px-3 pb-1">
                      <Link
                        href="/kamers/nieuw"
                        data-testid="header-new-listing-link"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-[0.98]"
                      >
                        <Plus className="h-4 w-4" />
                        {t("nav.postListing")}
                      </Link>
                    </div>
                  )}

                  {/* ── Admin section ───────────────────────────── */}
                  {userRole === "admin" && (
                    <>
                      <div className="mx-4 mt-2 mb-1 flex items-center gap-2">
                        <div className="h-px flex-1 bg-stone-100" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Admin</span>
                        <div className="h-px flex-1 bg-stone-100" />
                      </div>
                      <Link
                        href="/admin/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <ShieldCheck className="h-4 w-4 text-rose-500" />
                        {t("nav.adminDashboard")}
                      </Link>
                    </>
                  )}

                  <div className="my-1.5 border-t border-stone-100" />

                  {/* ── Sign out ────────────────────────────────── */}
                  <button
                    type="button"
                    data-testid="header-signout-button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                  >
                    <LogOut className="h-4 w-4 text-stone-400" />
                    {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <>
              <Link href="/inloggen" data-testid="header-login-link" className="flex items-center gap-1.5 text-stone-600 transition hover:text-rose-600">
                <LogIn className="h-4 w-4 text-stone-400" />
                {t("nav.login")}
              </Link>
              <Link
                href="/registreren"
                data-testid="header-register-link"
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
              >
                {t("nav.register")}
              </Link>
            </>
          )}
        </nav>

        {/* Mobile right side */}
        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <CitySelector />
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
            >
              {t("nav.logout")}
            </button>
          ) : (
            <Link
              href="/registreren"
              className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              {t("nav.register")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
