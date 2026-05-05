import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import type { UserType } from "@/types/database";

const USER_TYPE_LABELS: Record<UserType, string> = {
  tenant: "Huurder (algemeen)",
  landlord: "Verhuurder",
  student: "Student",
  professional: "Professional / Expat",
  family: "Familie",
};

type Props = {
  userId: string;
  userEmail: string;
  initialName: string;
  initialBio: string;
  initialPhone: string;
  initialAvatarUrl: string;
  initialUserType: UserType;
  isVerified: boolean;
  isPhoneVerified: boolean;
  onSaved?: () => void;
};

export function ProfileForm({ userId, userEmail, initialName, initialBio, initialPhone, initialAvatarUrl, initialUserType, isVerified, isPhoneVerified, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim().slice(0, 80);
    const bio = String(fd.get("bio") ?? "").trim().slice(0, 500);
    const phone = String(fd.get("phone") ?? "").trim().slice(0, 40);
    const avatarUrl = String(fd.get("avatar_url") ?? "").trim();
    const userType = String(fd.get("user_type") ?? "tenant") as UserType;

    startTransition(async () => {
      if (!supabase) { setError("Niet verbonden."); return; }
      const { error: err } = await supabase.from("profiles").update({ name: name || null, bio: bio || null, phone: phone || null, avatar_url: avatarUrl || null, user_type: userType }).eq("id", userId);
      if (err) { setError("Profiel opslaan mislukt."); return; }
      setSuccess(true);
      onSaved?.();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm" data-testid="profile-form">
      <div>
        <label className="text-xs font-medium text-stone-700">E-mailadres</label>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
          <span className="flex-1 truncate">{userEmail}</span>
          {isVerified && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
              Geverifieerd
            </span>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="profile-name" className="text-xs font-medium text-stone-700">Naam <span className="text-stone-400">(zichtbaar voor anderen)</span></label>
        <input id="profile-name" name="name" type="text" maxLength={80} defaultValue={initialName} placeholder="bijv. Anna van Dijk" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-name-input" />
      </div>
      <div>
        <label htmlFor="profile-user-type" className="text-xs font-medium text-stone-700">Wie ben je?</label>
        <select id="profile-user-type" name="user_type" defaultValue={initialUserType} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-user-type-select">
          {(Object.entries(USER_TYPE_LABELS) as [UserType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="profile-bio" className="text-xs font-medium text-stone-700">Over jezelf</label>
        <textarea id="profile-bio" name="bio" rows={4} maxLength={500} defaultValue={initialBio} placeholder="Vertel kort iets over jezelf..." className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-bio-input" />
      </div>
      <div>
        <label htmlFor="profile-phone" className="text-xs font-medium text-stone-700">Telefoon <span className="text-stone-400">(optioneel)</span></label>
        <div className="relative">
          <input id="profile-phone" name="phone" type="tel" maxLength={40} defaultValue={initialPhone} placeholder="+31 6 12345678" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 pr-24 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="profile-phone-input" />
          {isPhoneVerified && <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Geverifieerd</span>}
        </div>
      </div>
      {success && <p className="text-sm text-emerald-700">Profiel opgeslagen!</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-60">
        {isPending ? "Opslaan..." : "Profiel opslaan"}
      </button>
    </form>
  );
}
