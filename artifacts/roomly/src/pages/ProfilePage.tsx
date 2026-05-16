import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { MessageSquare, Bell, Home, KeyRound, Mail, Phone, CheckCircle2, Eye, EyeOff, Tag, UserCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { PasswordInput } from "@/components/ui/password-input";
import { OwnerBadges } from "@/components/listings/OwnerBadges";
import type { Profile, UserType } from "@/types/database";
import { isFullyVerified, isPartiallyVerified } from "@/lib/verificationUtils";

const PROFILE_PERSONAS: Record<UserType, { label: string; icon: string; description: string }> = {
  verhuurder:        { label: "Verhuurder",           icon: "🏢", description: "Ik verhuur kamers of woningen" },
  huisgenoot_zoeker: { label: "Huisgenoot zoeker",    icon: "🤝", description: "Op zoek naar een huisgenoot" },
  student:           { label: "Student",              icon: "🎓", description: "Ik studeer en zoek een kamer of studio" },
  professional:      { label: "Professional / Expat", icon: "💼", description: "Ik werk en zoek een appartement of kamer" },
  alleenstaande:     { label: "Alleenstaande",        icon: "🧍", description: "Ik zoek een woning voor mezelf" },
  family:            { label: "Familie · Stel",       icon: "🏡", description: "We zoeken naar een huis" },
};

const LIFESTYLE_TAGS = [
  "Student", "Niet roken", "Werkend", "Rustig",
  "Internationaal", "Sportief", "Houd van koken", "Huisdier vriendelijk",
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
      {children}
    </p>
  );
}

function Toggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
        checked ? "bg-rose-500" : "bg-stone-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function VerifiedBadge() {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      Geverifieerd
    </span>
  );
}

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  const [phoneVerifyStep, setPhoneVerifyStep] = useState<"idle" | "sending" | "code" | "verified">("idle");
  const [pendingPhone, setPendingPhone] = useState("");
  const [phoneVerifyInput, setPhoneVerifyInput] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyTimer, setVerifyTimer] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailVerifySending, setEmailVerifySending] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showDeleteModal && deleteModalRef.current) {
      deleteModalRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showDeleteModal]);

  const [savingPersona, setSavingPersona] = useState(false);
  const [personaAnimating, setPersonaAnimating] = useState(false);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwErrors, setPwErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});
  const [pwPending, setPwPending] = useState(false);

  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showAvatarInListings, setShowAvatarInListings] = useState(true);
  const [notifyNewMessage, setNotifyNewMessage] = useState(true);
  const [notifyApplicationUpdate, setNotifyApplicationUpdate] = useState(true);
  const [notifyMatchingListing, setNotifyMatchingListing] = useState(true);
  const [notifyEmailMessages, setNotifyEmailMessages] = useState(true);
  const [notifyEmailApplications, setNotifyEmailApplications] = useState(true);
  const [lifestyleTags, setLifestyleTags] = useState<string[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem("emailJustVerified")) {
      setShowVerifiedBanner(true);
      sessionStorage.removeItem("emailJustVerified");
      const t = setTimeout(() => setShowVerifiedBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile | null);
      setLoading(false);
    });
  }, [user, authLoading]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (phoneVerifyStep === "code" && verifyTimer > 0) {
      interval = setInterval(() => setVerifyTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [phoneVerifyStep, verifyTimer]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (emailCooldown > 0) {
      interval = setInterval(() => setEmailCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [emailCooldown]);

  useEffect(() => {
    if (profile) {
      setShowEmail(profile.show_email ?? false);
      setShowPhone(profile.show_phone ?? false);
      setShowAvatarInListings(profile.show_avatar_in_listings ?? true);
      if (profile.phone && !profile.phone_verified) {
        setPhoneVerifyInput(profile.phone);
      }
      setNotifyNewMessage(profile.notify_new_message ?? true);
      setNotifyApplicationUpdate(profile.notify_application_update ?? true);
      setNotifyMatchingListing(profile.notify_matching_listing ?? true);
      setNotifyEmailMessages(profile.notify_email_messages ?? true);
      setNotifyEmailApplications(profile.notify_email_applications ?? true);
      setLifestyleTags(profile.lifestyle_tags ?? []);
    }
  }, [profile]);

  const startPhoneVerification = async (phone: string) => {
    const normalized = phone.trim();
    if (!normalized) { toast.error("Voer eerst een telefoonnummer in."); return; }
    if (!/^\+\d{7,15}$/.test(normalized)) {
      toast.error("Gebruik internationaal formaat, bijv. +31612345678.");
      return;
    }
    if (!supabase || !user) { toast.error("Niet ingelogd."); return; }
    setPhoneVerifyStep("sending");
    setPendingPhone(normalized);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) {
      toast.error("Versturen mislukt: " + error.message);
      setPhoneVerifyStep("idle");
      return;
    }
    setPhoneVerifyStep("code");
    setVerifyTimer(60);
    setVerifyCode("");
    toast.success("Verificatiecode verzonden naar " + normalized);
  };

  const verifyPhoneCode = async () => {
    if (verifyCode.length !== 6) { toast.error("Voer een 6-cijferige code in."); return; }
    if (!supabase || !user) { toast.error("Niet ingelogd."); return; }
    setIsVerifying(true);
    const { error: otpErr } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: verifyCode,
      type: "sms",
    });
    if (otpErr) {
      toast.error("Ongeldige of verlopen code. Probeer opnieuw.");
      setIsVerifying(false);
      return;
    }
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ phone: pendingPhone, phone_verified: true })
      .eq("id", user.id);
    if (profileErr) {
      toast.error("Profiel bijwerken mislukt. Probeer opnieuw.");
      setIsVerifying(false);
      return;
    }
    setProfile((prev) => prev ? { ...prev, phone: pendingPhone, phone_verified: true } : prev);
    setPhoneVerifyStep("verified");
    setVerifyCode("");
    setIsVerifying(false);
    toast.success("Telefoonnummer geverifieerd!");
  };

  const resendVerificationCode = async () => {
    if (!supabase || !pendingPhone) return;
    const { error } = await supabase.auth.signInWithOtp({ phone: pendingPhone });
    if (error) { toast.error("Versturen mislukt: " + error.message); return; }
    setVerifyTimer(60);
    toast.success("Nieuwe verificatiecode verzonden.");
  };

  const sendEmailVerification = async () => {
    if (!supabase || !user?.email) { toast.error("Niet ingelogd."); return; }
    setEmailVerifySending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setEmailVerifySending(false);
    if (error) { toast.error("Versturen mislukt: " + error.message); return; }
    toast.success(`Verificatielink verzonden naar ${user.email}.`);
    setEmailCooldown(60);
  };

  const handlePrivacyToggle = async (field: "show_email" | "show_phone" | "show_avatar_in_listings", value: boolean) => {
    if (!supabase || !user) return;
    if (field === "show_email") setShowEmail(value);
    if (field === "show_phone") setShowPhone(value);
    if (field === "show_avatar_in_listings") setShowAvatarInListings(value);
    await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
  };

  const handleNotifToggle = async (
    field:
      | "notify_new_message"
      | "notify_application_update"
      | "notify_matching_listing"
      | "notify_email_messages"
      | "notify_email_applications",
    value: boolean
  ) => {
    if (!supabase || !user) return;
    if (field === "notify_new_message") setNotifyNewMessage(value);
    if (field === "notify_application_update") setNotifyApplicationUpdate(value);
    if (field === "notify_matching_listing") setNotifyMatchingListing(value);
    if (field === "notify_email_messages") setNotifyEmailMessages(value);
    if (field === "notify_email_applications") setNotifyEmailApplications(value);
    await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
  };

  const handleTagToggle = async (tag: string) => {
    if (!supabase || !user) return;
    const next = lifestyleTags.includes(tag)
      ? lifestyleTags.filter((t) => t !== tag)
      : [...lifestyleTags, tag];
    setLifestyleTags(next);
    await supabase.from("profiles").update({ lifestyle_tags: next }).eq("id", user.id);
  };

  const handleDeleteAccount = async () => {
    if (!supabase || !user?.email) return;
    setIsDeleting(true);
    try {
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      if (reAuthErr) {
        toast.error("Ongeldig wachtwoord. Probeer opnieuw.");
        setIsDeleting(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.rpc("delete_own_listings");
      await supabase.from("profiles").update({
        deleted_at: new Date().toISOString(),
        name: "Verwijderde gebruiker",
        email: null,
        phone: null,
        avatar_url: null,
        bio: null,
        email_auto_verified: false,
        phone_verified: false,
        student_verified: false,
        verification_badge: null,
      }).eq("id", user.id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      let edgeFnOk = false;
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ userId: user.id }),
        });
        edgeFnOk = resp.ok;
      } catch {
        edgeFnOk = false;
      }
      await supabase.auth.signOut();
      if (edgeFnOk) {
        toast.success("Je account is verwijderd. Je kunt opnieuw registreren met hetzelfde e-mailadres.");
      } else {
        toast.warning("Je account is verwijderd. Neem contact op met support als je problemen ervaart.");
      }
      navigate("/");
    } catch {
      toast.error("Er is iets misgegaan. Probeer het later opnieuw.");
      setIsDeleting(false);
    }
  };

  function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 {
    if (!pw) return 0;
    const types = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
    if (pw.length >= 10 && types >= 3) return 3;
    if (pw.length >= 8 && types >= 2) return 2;
    return 1;
  }

  const handlePasswordChange = async () => {
    const errs: { current?: string; new?: string; confirm?: string } = {};
    if (!pwCurrent) errs.current = "Voer je huidige wachtwoord in.";
    if (!pwNew) errs.new = "Voer een nieuw wachtwoord in.";
    else if (pwNew.length < 8) errs.new = "Minimaal 8 tekens.";
    if (!pwConfirm) errs.confirm = "Bevestig je nieuwe wachtwoord.";
    else if (pwNew && pwNew !== pwConfirm) errs.confirm = "Wachtwoorden komen niet overeen.";
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }
    if (!supabase || !user?.email) { toast.error("Niet ingelogd."); return; }
    setPwPending(true);
    const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: pwCurrent });
    if (reAuthErr) {
      toast.error("Huidig wachtwoord is onjuist.");
      setPwErrors({ current: "Huidig wachtwoord is onjuist." });
      setPwPending(false);
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwNew });
    setPwPending(false);
    if (updateErr) { toast.error("Bijwerken mislukt: " + updateErr.message); return; }
    setPwCurrent(""); setPwNew(""); setPwConfirm(""); setPwErrors({});
    toast.success("Wachtwoord bijgewerkt.");
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je profiel te bewerken</h1>
        <Link href="/inloggen?next=/profiel" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">
          Inloggen
        </Link>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const bio = String(fd.get("bio") ?? "").trim();
    if (!name) { toast.error("Naam mag niet leeg zijn."); return; }
    startTransition(async () => {
      if (!supabase || !user) { toast.error("Niet ingelogd."); return; }
      const { error: err } = await supabase.from("profiles").upsert({
        id: user.id,
        name,
        bio,
        avatar_url: profile?.avatar_url ?? null,
        email: user.email ?? null,
      });
      if (err) { toast.error("Opslaan mislukt. Probeer het opnieuw."); return; }
      setProfile((prev) => prev ? { ...prev, name, bio } : prev);
      toast.success("Profiel opgeslagen.");
    });
  };


  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">

      {/* Verified banner */}
      {showVerifiedBanner && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-800">Je e-mailadres is geverifieerd.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowVerifiedBanner(false)}
            className="shrink-0 rounded-lg p-1 text-emerald-500 hover:bg-emerald-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Page header */}
      <nav className="mb-5 text-sm text-stone-400">
        <Link href="/dashboard" className="transition hover:text-stone-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-600">Instellingen</span>
      </nav>
      <h1 className="mb-8 text-2xl font-bold text-stone-900">Instellingen</h1>

      {loading ? (
        <div className="space-y-3">
          <div className="mx-auto h-20 w-20 rounded-full bg-stone-100 animate-pulse" />
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-10 rounded-xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── PROFIEL ── */}
          <section>
            <SectionHeading>Profiel</SectionHeading>
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-6">
              {user && (
                <div className="mb-6 flex justify-center border-b border-stone-100 pb-6">
                  <AvatarUpload
                    userId={user.id}
                    currentUrl={profile?.avatar_url}
                    onUploaded={(url) =>
                      setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev)
                    }
                  />
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4" data-testid="profile-form">
                <div>
                  <label htmlFor="prof-name" className="text-xs font-medium text-stone-600">Naam *</label>
                  <input
                    id="prof-name"
                    name="name"
                    type="text"
                    required
                    defaultValue={profile?.name ?? ""}
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    data-testid="profile-name"
                  />
                </div>

                <div>
                  <label htmlFor="prof-bio" className="text-xs font-medium text-stone-600">Bio</label>
                  <textarea
                    id="prof-bio"
                    name="bio"
                    rows={3}
                    defaultValue={profile?.bio ?? ""}
                    maxLength={500}
                    placeholder="Vertel iets over jezelf…"
                    className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    data-testid="profile-bio"
                  />
                </div>

                <div>
                  <label htmlFor="prof-email" className="text-xs font-medium text-stone-600">E-mailadres</label>
                  <input
                    id="prof-email"
                    type="email"
                    readOnly
                    value={user?.email ?? ""}
                    className="mt-1.5 w-full rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm text-stone-400 cursor-default focus:outline-none"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isPending}
                    data-testid="profile-save"
                    className="w-full rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Opslaan…
                      </span>
                    ) : "Opslaan"}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* ── PROFIELTYPE ── */}
          <section>
            <SectionHeading>Profieltype</SectionHeading>
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-6">
              {profile?.role === "admin" && (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Admin — testmodus
                </span>
              )}

              {profile?.role === "admin" ? (
                <>
                  <p className="mb-4 text-sm text-stone-500">Als admin kun je je profieltype wisselen voor testdoeleinden.</p>
                  <div
                    className="grid gap-2.5 transition-opacity duration-200"
                    style={{ opacity: personaAnimating ? 0 : 1 }}
                  >
                    {(Object.entries(PROFILE_PERSONAS) as [UserType, typeof PROFILE_PERSONAS[UserType]][]).map(([key, persona]) => {
                      const isActive = profile?.user_type === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={savingPersona || isActive}
                          onClick={async () => {
                            if (!supabase || !user) return;
                            setSavingPersona(true);
                            setPersonaAnimating(true);
                            const { error } = await supabase.from("profiles").update({ user_type: key }).eq("id", user.id);
                            setSavingPersona(false);
                            setTimeout(() => setPersonaAnimating(false), 200);
                            if (error) { toast.error("Opslaan mislukt."); return; }
                            setProfile((prev) => prev ? { ...prev, user_type: key } : prev);
                            toast.success(`Profieltype gewijzigd naar "${persona.label}".`);
                          }}
                          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition active:scale-[0.99] disabled:cursor-default ${
                            isActive
                              ? "border-rose-400 bg-rose-50"
                              : "border-stone-200 bg-white hover:border-rose-300 disabled:opacity-50"
                          }`}
                        >
                          <span className="text-lg leading-none">{persona.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${isActive ? "text-rose-700" : "text-stone-900"}`}>
                              {persona.label}
                            </p>
                            <p className="text-xs text-stone-500">{persona.description}</p>
                          </div>
                          {isActive && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-rose-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : profile?.user_type ? (
                <>
                  <p className="mb-3 text-sm text-stone-500">Je profieltype is ingesteld.</p>
                  {(() => {
                    const persona = PROFILE_PERSONAS[profile.user_type as UserType];
                    if (!persona) return null;
                    return (
                      <div className="inline-flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                        <span className="text-2xl leading-none">{persona.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{persona.label}</p>
                          <p className="text-xs text-stone-500">{persona.description}</p>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-sm text-stone-600">Profieltype nog niet ingesteld</p>
                  <Link href="/welkom" className="shrink-0 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600">
                    Instellen
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* ── LEVENSSTIJL TAGS — only for huisgenoot_zoeker ── */}
          {user && profile?.user_type === "huisgenoot_zoeker" && (
            <section>
              <SectionHeading>Levensstijl</SectionHeading>
              <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-1 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-stone-400" />
                  <p className="text-sm font-medium text-stone-800">Levensstijl tags</p>
                </div>
                <p className="mb-4 text-xs text-stone-500">
                  Selecteer tags die jouw levensstijl omschrijven. Ze verschijnen op jouw huisgenotenkaart.
                </p>
                <div className="flex flex-wrap gap-2">
                  {LIFESTYLE_TAGS.map((tag) => {
                    const active = lifestyleTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
                          active
                            ? "bg-rose-500 text-white shadow-sm"
                            : "border border-stone-200 bg-white text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        }`}
                      >
                        {active && (
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {lifestyleTags.length > 0 && (
                  <p className="mt-4 text-xs text-stone-400">
                    {lifestyleTags.length} tag{lifestyleTags.length !== 1 ? "s" : ""} geselecteerd — automatisch opgeslagen.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── ZO ZIEN ANDEREN JOU ── */}
          {profile && (
            <section>
              <SectionHeading>Zo zien anderen jou</SectionHeading>
              <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-6">
                <p className="mb-4 text-sm text-stone-500">Dit is hoe verhuurders of huisgenoten jouw profiel zien.</p>
                <OwnerBadges
                  profile={{ ...profile, lifestyle_tags: lifestyleTags }}
                  memberSince={user?.created_at ?? new Date().toISOString()}
                />
              </div>
            </section>
          )}

          {/* ── VERIFICATIE ── */}
          <section>
            <SectionHeading>Verificatie</SectionHeading>
            <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">

              {/* Status summary */}
              <div className="border-b border-stone-100 px-5 py-4 sm:px-6">
                {isFullyVerified(profile) ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <p className="text-sm text-emerald-800">Je account is volledig geverifieerd.</p>
                  </div>
                ) : isPartiallyVerified(profile) ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <p className="text-sm text-stone-700">Gedeeltelijk geverifieerd. Voeg e-mail of telefoon toe voor meer vertrouwen.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-stone-300" />
                    <p className="text-sm text-stone-500">Geverifieerde gegevens vergroten je kansen bij verhuurders.</p>
                  </div>
                )}
              </div>

              {/* E-mail row */}
              <div className="border-b border-stone-100 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                      <Mail className="h-4 w-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">E-mailadres</p>
                      <p className="text-xs text-stone-400 mt-0.5">{user?.email}</p>
                    </div>
                  </div>
                  {profile?.email_auto_verified ? (
                    <VerifiedBadge />
                  ) : (
                    <button
                      type="button"
                      disabled={emailVerifySending || emailCooldown > 0}
                      onClick={sendEmailVerification}
                      className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                    >
                      {emailVerifySending ? "Versturen…" : emailCooldown > 0 ? `Opnieuw (${emailCooldown}s)` : "E-mail verifiëren"}
                    </button>
                  )}
                </div>
              </div>

              {/* Telefoon row */}
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                      <Phone className="h-4 w-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">Telefoonnummer</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {profile?.phone_verified
                          ? (profile?.phone ?? "Geverifieerd")
                          : (profile?.phone ?? "Nog niet ingevuld")}
                      </p>
                    </div>
                  </div>
                  {profile?.phone_verified && <VerifiedBadge />}
                </div>

                {/* Phone input + verify button — shown when not yet verified */}
                {!profile?.phone_verified && (phoneVerifyStep === "idle" || phoneVerifyStep === "sending") && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="tel"
                      value={phoneVerifyInput}
                      onChange={(e) => setPhoneVerifyInput(e.target.value)}
                      placeholder="+31612345678"
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                    <button
                      type="button"
                      disabled={phoneVerifyStep === "sending" || !phoneVerifyInput.trim()}
                      onClick={() => startPhoneVerification(phoneVerifyInput)}
                      className="shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                    >
                      {phoneVerifyStep === "sending" ? "Versturen…" : "Verifiëren"}
                    </button>
                  </div>
                )}

                {/* OTP code entry */}
                {phoneVerifyStep === "code" && (
                  <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-medium text-stone-800">Verificatiecode invoeren</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      We stuurden een 6-cijferige code per SMS naar <span className="font-medium">{pendingPhone}</span>.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        maxLength={6}
                        className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                      <button
                        type="button"
                        onClick={verifyPhoneCode}
                        disabled={isVerifying || verifyCode.length !== 6}
                        className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50"
                      >
                        {isVerifying ? "Controleren…" : "Bevestigen"}
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs text-stone-400">
                      {verifyTimer > 0 ? (
                        <span>Nieuwe code in {verifyTimer}s</span>
                      ) : (
                        <button type="button" onClick={resendVerificationCode} className="text-rose-600 hover:underline">
                          Nieuwe code versturen
                        </button>
                      )}
                      <button type="button" onClick={() => setPhoneVerifyStep("idle")} className="hover:underline">
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}

                {phoneVerifyStep === "verified" && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Telefoonnummer succesvol geverifieerd.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── PRIVACY ── */}
          <section>
            <SectionHeading>Privacy</SectionHeading>
            <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-stone-100 px-5 py-4 sm:px-6">
                <p className="text-xs text-stone-400">Bepaal welke contactgegevens zichtbaar zijn voor anderen op Welkthuis.</p>
              </div>

              <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                    {showEmail ? <Eye className="h-4 w-4 text-stone-400" /> : <EyeOff className="h-4 w-4 text-stone-300" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-800">E-mailadres zichtbaar</p>
                    <p className="text-xs text-stone-400 mt-0.5">Anderen zien je e-mailadres op je profiel</p>
                  </div>
                </div>
                <Toggle checked={showEmail} onToggle={() => handlePrivacyToggle("show_email", !showEmail)} />
              </div>

              <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                    {showPhone ? <Eye className="h-4 w-4 text-stone-400" /> : <EyeOff className="h-4 w-4 text-stone-300" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-800">Telefoonnummer zichtbaar</p>
                    <p className="text-xs text-stone-400 mt-0.5">Anderen zien je telefoonnummer op je profiel</p>
                  </div>
                </div>
                <Toggle checked={showPhone} onToggle={() => handlePrivacyToggle("show_phone", !showPhone)} />
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                    <UserCircle2 className={`h-4 w-4 ${showAvatarInListings ? "text-stone-400" : "text-stone-300"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-800">Profielfoto in advertenties</p>
                    <p className="text-xs text-stone-400 mt-0.5">Toon je profielfoto naast je advertenties in het woningoverzicht</p>
                  </div>
                </div>
                <Toggle checked={showAvatarInListings} onToggle={() => handlePrivacyToggle("show_avatar_in_listings", !showAvatarInListings)} />
              </div>
            </div>
          </section>

          {/* ── NOTIFICATIES ── */}
          {profile && (
            <section>
              <SectionHeading>Notificaties</SectionHeading>
              <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-stone-100 px-5 py-4 sm:px-6">
                  <p className="text-xs text-stone-400">Kies voor welke activiteiten je een melding wilt ontvangen.</p>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                      <MessageSquare className="h-4 w-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">Nieuwe berichten</p>
                      <p className="text-xs text-stone-400 mt-0.5">Melding bij een nieuw chatbericht</p>
                    </div>
                  </div>
                  <Toggle
                    checked={notifyNewMessage}
                    onToggle={() => handleNotifToggle("notify_new_message", !notifyNewMessage)}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                      <Bell className="h-4 w-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">Aanvraag updates</p>
                      <p className="text-xs text-stone-400 mt-0.5">Melding als je aanvraag wordt geaccepteerd of afgewezen</p>
                    </div>
                  </div>
                  <Toggle
                    checked={notifyApplicationUpdate}
                    onToggle={() => handleNotifToggle("notify_application_update", !notifyApplicationUpdate)}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                      <Home className="h-4 w-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">Nieuwe woningen</p>
                      <p className="text-xs text-stone-400 mt-0.5">Melding als een woning overeenkomt met je zoekopdracht</p>
                    </div>
                  </div>
                  <Toggle
                    checked={notifyMatchingListing}
                    onToggle={() => handleNotifToggle("notify_matching_listing", !notifyMatchingListing)}
                  />
                </div>

                {/* ── E-mail meldingen subheader ── */}
                <div className="border-b border-stone-100 px-5 py-3 sm:px-6 bg-stone-50/60">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">E-mail meldingen</p>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                      <Mail className="h-4 w-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">E-mail bij nieuw bericht</p>
                      <p className="text-xs text-stone-400 mt-0.5">Ontvang een e-mail als je een nieuw chatbericht krijgt</p>
                    </div>
                  </div>
                  <Toggle
                    checked={notifyEmailMessages}
                    onToggle={() => handleNotifToggle("notify_email_messages", !notifyEmailMessages)}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50">
                      <Mail className="h-4 w-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">E-mail bij nieuwe aanvraag</p>
                      <p className="text-xs text-stone-400 mt-0.5">Ontvang een e-mail als iemand reageert op jouw advertentie</p>
                    </div>
                  </div>
                  <Toggle
                    checked={notifyEmailApplications}
                    onToggle={() => handleNotifToggle("notify_email_applications", !notifyEmailApplications)}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── ACCOUNT VERWIJDEREN (inline) ── */}
          {showDeleteModal && (
            <div ref={deleteModalRef} className="w-full rounded-2xl border border-red-200 bg-white shadow-sm p-6 sm:p-7">
              <h2 className="text-base font-semibold text-stone-900">Account verwijderen</h2>
              <p className="mt-2 mb-5 text-sm text-stone-500">
                Voer je e-mailadres en wachtwoord in om je account definitief te verwijderen. Dit kan niet ongedaan worden gemaakt.
              </p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="delete-email" className="text-xs font-medium text-stone-600">
                    E-mailadres
                  </label>
                  <input
                    id="delete-email"
                    type="email"
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                    placeholder={user?.email ?? "jij@example.nl"}
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-100"
                  />
                </div>
                <div>
                  <label htmlFor="delete-password" className="text-xs font-medium text-stone-600">
                    Wachtwoord
                  </label>
                  <input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-100"
                  />
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50 sm:w-auto"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  disabled={
                    isDeleting ||
                    deleteEmail.trim().toLowerCase() !== (user?.email ?? "").toLowerCase() ||
                    deletePassword.length === 0
                  }
                  onClick={handleDeleteAccount}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40 active:scale-[0.98] sm:w-auto"
                >
                  {isDeleting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verwijderen…
                    </>
                  ) : "Verwijder mijn account"}
                </button>
              </div>
            </div>
          )}

          {/* ── BEVEILIGING ── */}
          {user && (
            <section>
              <SectionHeading>Beveiliging</SectionHeading>
              <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">

                {/* Wachtwoord wijzigen */}
                <div className="px-5 py-5 sm:px-6">
                  <div className="mb-4 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-stone-400" />
                    <p className="text-sm font-medium text-stone-800">Wachtwoord wijzigen</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-stone-600">Huidig wachtwoord</label>
                      <div className="mt-1.5">
                        <PasswordInput
                          value={pwCurrent}
                          onChange={(e) => { setPwCurrent(e.target.value); setPwErrors((p) => ({ ...p, current: undefined })); }}
                          placeholder="••••••••"
                          className={pwErrors.current ? "border-rose-300" : ""}
                        />
                      </div>
                      {pwErrors.current && <p className="mt-1 text-xs text-rose-500">{pwErrors.current}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-stone-600">Nieuw wachtwoord</label>
                      <div className="mt-1.5">
                        <PasswordInput
                          value={pwNew}
                          onChange={(e) => { setPwNew(e.target.value); setPwErrors((p) => ({ ...p, new: undefined })); }}
                          placeholder="Minimaal 8 tekens"
                          className={pwErrors.new ? "border-rose-300" : ""}
                        />
                      </div>
                      {pwNew && (() => {
                        const strength = getPasswordStrength(pwNew);
                        const labels = ["", "Zwak", "Matig", "Sterk"];
                        const colors = ["", "bg-rose-400", "bg-amber-400", "bg-emerald-500"];
                        const textColors = ["", "text-rose-500", "text-amber-500", "text-emerald-600"];
                        return (
                          <div className="mt-2">
                            <div className="flex gap-1">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? colors[strength] : "bg-stone-100"}`} />
                              ))}
                            </div>
                            <p className={`mt-1 text-xs font-medium ${textColors[strength]}`}>{labels[strength]}</p>
                          </div>
                        );
                      })()}
                      {pwErrors.new && <p className="mt-1 text-xs text-rose-500">{pwErrors.new}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-stone-600">Bevestig nieuw wachtwoord</label>
                      <div className="mt-1.5">
                        <PasswordInput
                          value={pwConfirm}
                          onChange={(e) => { setPwConfirm(e.target.value); setPwErrors((p) => ({ ...p, confirm: undefined })); }}
                          placeholder="Herhaal nieuw wachtwoord"
                          className={pwErrors.confirm ? "border-rose-300" : ""}
                        />
                      </div>
                      {pwErrors.confirm && <p className="mt-1 text-xs text-rose-500">{pwErrors.confirm}</p>}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={pwPending}
                      onClick={handlePasswordChange}
                      className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {pwPending ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Bijwerken…
                        </>
                      ) : "Wachtwoord bijwerken"}
                    </button>
                  </div>
                </div>

                {/* Account verwijderen */}
                <div className="border-t border-stone-100 px-5 py-5 sm:px-6">
                  <p className="text-sm font-medium text-stone-800 mb-1">Account beëindigen</p>
                  <p className="text-xs text-stone-400 mb-3">
                    Al je gegevens worden definitief verwijderd conform de AVG/GDPR richtlijnen.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setDeleteEmail(""); setDeletePassword(""); setShowDeleteModal(true); }}
                    className="text-xs font-medium text-stone-400 underline underline-offset-2 transition hover:text-stone-700"
                  >
                    Account verwijderen
                  </button>
                </div>
              </div>
            </section>
          )}

          <div className="h-4" />
        </div>
      )}

    </div>
  );
}

