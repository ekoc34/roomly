import { Link, useLocation } from "wouter";
import { Building2, Map, Heart, MessageSquare, LayoutDashboard, LogOut, Plus, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { CitySelector } from "@/components/search/CitySelector";
import { NotificationBell } from "@/components/layout/NotificationBell";

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

export function Header() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const [path, navigate] = useLocation();

  const isKamers    = path === "/kamers" || (path.startsWith("/kamers/") && path !== "/kamers/nieuw");
  const isKaart     = path === "/kaart";
  const isFavorieten = path.startsWith("/favorieten");
  const isBerichten  = path.startsWith("/berichten");
  const isDashboard  = path === "/dashboard";
  const isNieuw      = path === "/kamers/nieuw";

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" data-testid="header-logo" className="text-xl font-bold tracking-tight text-rose-600">
          Welkthuis
        </Link>

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
          {user ? (
            <>
              <Link href="/favorieten" data-testid="header-favorites-link" className={navCls(isFavorieten)}>
                <Heart className={iconCls(isFavorieten)} />
                Favorieten
              </Link>
              <Link href="/berichten" data-testid="header-messages-link" className={`relative ${navCls(isBerichten)}`}>
                <MessageSquare className={iconCls(isBerichten)} />
                Berichten
                {unreadCount !== null && unreadCount > 0 && (
                  <span
                    data-testid="header-unread-badge"
                    className="absolute -right-3 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/dashboard" className={navCls(isDashboard)}>
                <LayoutDashboard className={iconCls(isDashboard)} />
                Dashboard
              </Link>
              <NotificationBell />
              <Link
                href="/kamers/nieuw"
                data-testid="header-new-listing-link"
                className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 transition ${
                  isNieuw
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-stone-200 text-stone-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                }`}
              >
                <Plus className="h-4 w-4" />
                Advertentie plaatsen
              </Link>
              <button
                type="button"
                data-testid="header-signout-button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-rose-600"
              >
                <LogOut className="h-4 w-4" />
                Uitloggen
              </button>
            </>
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

        <div className="flex items-center gap-2 md:hidden">
          <CitySelector />
          {user ? (
            <>
              <NotificationBell />
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
              >
                Uitloggen
              </button>
            </>
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
