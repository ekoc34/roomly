import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldAlert, FileWarning, MessageSquareWarning, Mail, ShieldCheck } from "lucide-react";
import { useAdminNotifications, AdminNotifKind } from "@/hooks/useAdminNotifications";

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m geleden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u geleden`;
  return `${Math.floor(hrs / 24)}d geleden`;
}

function kindMeta(kind: AdminNotifKind): {
  icon: React.ReactNode;
  label: string;
  dot: string;
  bg: string;
} {
  switch (kind) {
    case "scam_report":
      return {
        icon: <FileWarning className="h-3.5 w-3.5" />,
        label: "Scam-melding",
        dot: "bg-rose-500",
        bg: "bg-rose-50 text-rose-600",
      };
    case "user_report":
      return {
        icon: <MessageSquareWarning className="h-3.5 w-3.5" />,
        label: "Gebruikersmelding",
        dot: "bg-amber-500",
        bg: "bg-amber-50 text-amber-700",
      };
    case "contact_message":
      return {
        icon: <Mail className="h-3.5 w-3.5" />,
        label: "Contactbericht",
        dot: "bg-blue-500",
        bg: "bg-blue-50 text-blue-600",
      };
  }
}

interface Props {
  isAdmin: boolean;
}

export function AdminNotificationBell({ isAdmin }: Props) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, totalCount, loading } = useAdminNotifications(isAdmin);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  if (!isAdmin) return null;

  function handleItemClick() {
    setOpen(false);
    navigate("/admin/dashboard");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Admin meldingen"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
      >
        <ShieldAlert className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        {totalCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-200/60">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-rose-500" />
            <span className="text-sm font-semibold text-stone-900">Admin meldingen</span>
            {totalCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                {totalCount}
              </span>
            )}
          </div>

          {/* Items */}
          <div className="divide-y divide-stone-50">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-rose-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                Geen openstaande meldingen
              </div>
            ) : (
              items.map((item) => {
                const meta = kindMeta(item.kind);
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={handleItemClick}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-stone-100"
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                          {meta.label}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-stone-400">
                          {fmtRelative(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-stone-800">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-stone-500">{item.preview}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-stone-100 px-4 py-2.5">
            <button
              type="button"
              onClick={handleItemClick}
              className="w-full text-center text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              Alle meldingen bekijken →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
