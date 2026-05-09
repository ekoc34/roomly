import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Building2, Map, LogIn, Heart, MessageSquare, Bell, LayoutDashboard, Plus, LogOut, Scale, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useCompare } from "@/contexts/CompareContext";
import { CitySelector } from "@/components/search/CitySelector";

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
  const { compareIds } = useCompare();
  const [path, navigate] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
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
      .select("avatar_url, name, role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url ?? null);
          setDisplayName(data.name ?? null);
          setUserRole(data.role ?? null);
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
            Woningen
          </Link>
          <Link href="/kaart" data-testid="header-kaart-link" className={navCls(isKaart)}>
            <Map className={iconCls(isKaart)} />
            Kaart
          </Link>
          <CitySelector />

          {compareIds.length > 0 && (
            <Link
              href={`/vergelijk?ids=${compareIds.join(",")}`}
              className="hidden items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100 md:flex"
            >
              <Scale className="h-4 w-4" />
              Vergelijk ({compareIds.length})
            </Link>
          )}

          {user ? (
            /* Profile dropdown */
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
                    alt={displayName ?? "Profiel"}
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
                <div className="absolute right-0 top-full mt-2 min-w-[200px] rounded-2xl border border-stone-200 bg-white py-2 shadow-lg">
                  <div className="px-4 py-3 border-b border-stone-100">
                    <p className="font-semibold text-sm text-stone-900 truncate">
                      {displayName ?? "Gebruiker"}
                    </p>
                    <p className="text-xs text-stone-400 truncate mt-0.5">
                      {user?.email ?? ""}
                    </p>
                  </div>
                  <Link
                    href="/favorieten"
                    data-testid="header-favorites-link"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <Heart className="h-4 w-4 text-stone-400" />
                    Favorieten
                  </Link>
                  <Link
                    href="/berichten"
                    data-testid="header-messages-link"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <MessageSquare className="h-4 w-4 text-stone-400" />
                    Berichten
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
                    Notificaties
                  </Link>
                  {userRole === "admin" && (
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <ShieldCheck className="h-4 w-4 text-rose-500" />
                      Admin Dashboard
                    </Link>
                  )}

                  <div className="my-1.5 border-t border-stone-100" />

                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <LayoutDashboard className="h-4 w-4 text-stone-400" />
                    Dashboard
                  </Link>
                  <Link
                    href="/kamers/nieuw"
                    data-testid="header-new-listing-link"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <Plus className="h-4 w-4 text-stone-400" />
                    Advertentie plaatsen
                  </Link>

                  <div className="my-1.5 border-t border-stone-100" />

                  <button
                    type="button"
                    data-testid="header-signout-button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <LogOut className="h-4 w-4 text-stone-400" />
                    Uitloggen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/inloggen" data-testid="header-login-link" className="flex items-center gap-1.5 text-stone-600 transition hover:text-rose-600">
                <LogIn className="h-4 w-4 text-stone-400" />
                Inloggen
              </Link>
              <Link
                href="/registreren"
                data-testid="header-register-link"
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
              >
                Gratis aanmelden
              </Link>
            </>
          )}
        </nav>

        {/* Mobile right side — unchanged */}
        <div className="flex items-center gap-2 md:hidden">
          <CitySelector />
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
            >
              Uitloggen
            </button>
          ) : (
            <Link
              href="/registreren"
              className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              Gratis aanmelden
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
