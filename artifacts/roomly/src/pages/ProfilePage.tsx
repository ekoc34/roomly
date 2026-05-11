import { useEffect, useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { MessageSquare, Bell, Search, AlertTriangle, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { PasswordInput } from "@/components/ui/password-input";
import type { Profile, UserType } from "@/types/database";
import { isFullyVerified, isPartiallyVerified } from "@/lib/verificationUtils";

const PROFILE_PERSONAS: Record<UserType, { label: string; icon: string; description: string; color: string }> = {
  verhuurder:       { label: "Verhuurder",          icon: "🏢", description: "Ik verhuur kamers of woningen",               color: "amber"   },
  huisgenoot_zoeker:{ label: "Huisgenoot zoeker",   icon: "🤝", description: "Ik zoek iemand om mee samen te wonen",        color: "blue"    },
  student:          { label: "Student",             icon: "🎓", description: "Ik studeer en zoek een kamer of studio",      color: "rose"    },
  professional:     { label: "Professional / Expat",icon: "💼", description: "Ik werk en zoek een appartement of kamer",    color: "blue"    },
  alleenstaande:    { label: "Alleenstaande",        icon: "🧍", description: "Ik zoek een woning voor mezelf",             color: "rose"    },
  family:           { label: "Familie",             icon: "🏡", description: "Wij zoeken een woning als gezin",             color: "emerald" },
};

const PERSONA_BG: Record<string, string> = {
  rose:    "bg-rose-50 group-hover:bg-rose-100",
  blue:    "bg-blue-50 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 group-hover:bg-emerald-100",
  amber:   "bg-amber-50 group-hover:bg-amber-100",
};

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);
  const [phoneVerifyStep, setPhoneVerifyStep] = useState<"idle" | "sending" | "code" | "verified">("idle");
  const [pendingPhone, setPendingPhone] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyTimer, setVerifyTimer] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [savingPersona, setSavingPersona] = useState(false);
  const [personaStep, setPersonaStep] = useState<1 | 2>(1);
  const [personaAnimating, setPersonaAnimating] = useState(false);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwErrors, setPwErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});
  const [pwPending, setPwPending] = useState(false);

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

    // OTP verified — persist phone number and set phone_verified flag
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
    toast.success("Nieuwe verificatiecode verzonden naar " + pendingPhone);
  };

  const [emailVerifySending, setEmailVerifySending] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (emailCooldown > 0) {
      interval = setInterval(() => setEmailCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [emailCooldown]);

  const sendEmailVerification = async () => {
    if (!supabase || !user?.email) { toast.error("Niet ingelogd."); return; }
    setEmailVerifySending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setEmailVerifySending(false);
    if (error) {
      toast.error("Versturen mislukt: " + error.message);
      return;
    }
    toast.success(`Verificatielink verzonden naar ${user.email}. Check je inbox!`);
    setEmailCooldown(60);
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

      // Capture session JWT before sign-out — needed for the Edge Function call
      const { data: { session } } = await supabase.auth.getSession();

      // Anonymise listings so existing conversations aren't broken for the other party
      await supabase.from("listings").update({ user_id: null }).eq("user_id", user.id);

      // Soft-delete: anonymise personal data and set deleted_at timestamp.
      // This keeps the row (and its FK references) intact while blocking future logins.
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

      // Call the Edge Function to permanently delete the auth.users record
      // so the user can re-register with the same e-mail address later.
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
        toast.success("Je account is definitief verwijderd. Je kunt nu opnieuw registreren met hetzelfde e-mailadres.");
      } else {
        toast.warning("Je account is verwijderd maar er is een fout opgetreden. Neem contact op met support.");
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
    else if (pwNew.length < 8) errs.new = "Nieuw wachtwoord moet minimaal 8 tekens bevatten.";
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
    if (updateErr) {
      toast.error("Wachtwoord bijwerken mislukt: " + updateErr.message);
      return;
    }

    setPwCurrent(""); setPwNew(""); setPwConfirm(""); setPwErrors({});
    toast.success("Wachtwoord succesvol bijgewerkt.");
  };

  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [notifyNewMessage, setNotifyNewMessage] = useState(true);
  const [notifyApplicationUpdate, setNotifyApplicationUpdate] = useState(true);
  const [notifyMatchingListing, setNotifyMatchingListing] = useState(true);

  useEffect(() => {
    if (profile) {
      setShowEmail(profile.show_email ?? false);
      setShowPhone(profile.show_phone ?? false);
      setNotifyNewMessage(profile.notify_new_message ?? true);
      setNotifyApplicationUpdate(profile.notify_application_update ?? true);
      setNotifyMatchingListing(profile.notify_matching_listing ?? true);
    }
  }, [profile]);

  const handleNotifToggle = async (
    field: "notify_new_message" | "notify_application_update" | "notify_matching_listing",
    value: boolean
  ) => {
    if (!supabase || !user) return;
    if (field === "notify_new_message") setNotifyNewMessage(value);
    if (field === "notify_application_update") setNotifyApplicationUpdate(value);
    if (field === "notify_matching_listing") setNotifyMatchingListing(value);
    await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je profiel te bewerken</h1>
        <Link href="/inloggen?next=/profiel" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const bio = String(fd.get("bio") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    if (!name) { toast.error("Naam mag niet leeg zijn."); return; }
    startTransition(async () => {
      if (!supabase || !user) { toast.error("Niet ingelogd."); return; }
      const { error: err } = await supabase.from("profiles").upsert({
        id: user.id,
        name,
        bio,
        phone,
        avatar_url: profile?.avatar_url ?? null,
        email: user.email ?? null,
        show_email: showEmail,
        show_phone: showPhone,
      });
      if (err) { toast.error("Opslaan mislukt. Probeer het opnieuw."); return; }
      setProfile((prev) => prev ? { ...prev, name, bio, phone, show_email: showEmail, show_phone: showPhone } : prev);
      toast.success("Profiel opgeslagen!");
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {showVerifiedBanner && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-emerald-800">Je e-mailadres is geverifieerd! Je profiel is nu completer.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowVerifiedBanner(false)}
            className="shrink-0 rounded-lg p-1 text-emerald-600 transition hover:bg-emerald-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="transition hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Profiel bewerken</span>
      </nav>
      <h1 className="text-2xl font-bold text-stone-900">Mijn profiel</h1>

      <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
        {loading ? (
          <div className="space-y-4">
            <div className="mx-auto h-24 w-24 skeleton rounded-full" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {user && (
              <div className="flex flex-col items-center border-b border-stone-100 pb-6">
                <AvatarUpload
                  userId={user.id}
                  currentUrl={profile?.avatar_url}
                  onUploaded={(url) =>
                    setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev)
                  }
                />
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5" data-testid="profile-form">
              <div>
                <label htmlFor="prof-name" className="text-xs font-medium text-stone-700">Naam *</label>
                <input
                  id="prof-name"
                  name="name"
                  type="text"
                  required
                  defaultValue={profile?.name ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  data-testid="profile-name"
                />
              </div>
              <div>
                <label htmlFor="prof-bio" className="text-xs font-medium text-stone-700">Bio</label>
                <textarea
                  id="prof-bio"
                  name="bio"
                  rows={4}
                  defaultValue={profile?.bio ?? ""}
                  maxLength={500}
                  placeholder="Vertel iets over jezelf…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  data-testid="profile-bio"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-700">E-mailadres</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="email"
                    readOnly
                    value={user?.email ?? ""}
                    className="flex-1 rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm text-stone-500 cursor-default focus:outline-none"
                  />
                  {!profile?.email_auto_verified ? (
                    <button
                      type="button"
                      disabled={emailVerifySending || emailCooldown > 0}
                      onClick={sendEmailVerification}
                      className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      {emailVerifySending ? "Versturen…" : emailCooldown > 0 ? `Opnieuw versturen (${emailCooldown}s)` : "Verifiëren"}
                    </button>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Geverifieerd
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="prof-phone" className="text-xs font-medium text-stone-700">Telefoonnummer</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="prof-phone"
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="+31 6 12345678"
                    className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    data-testid="profile-phone"
                  />
                  {!profile?.phone_verified && (phoneVerifyStep === "idle" || phoneVerifyStep === "sending") && (
                    <button
                      type="button"
                      disabled={phoneVerifyStep === "sending"}
                      onClick={() => {
                        const phoneInput = document.getElementById("prof-phone") as HTMLInputElement;
                        startPhoneVerification(phoneInput.value);
                      }}
                      className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      {phoneVerifyStep === "sending" ? "Versturen…" : "Verifiëren"}
                    </button>
                  )}
                  {profile?.phone_verified && (
                    <span className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Geverifieerd
                    </span>
                  )}
                </div>
                {phoneVerifyStep === "code" && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-semibold text-blue-900">Voer de verificatiecode in</p>
                    <p className="mt-1 text-xs text-blue-700">We hebben een 6-cijferige code per SMS naar <span className="font-medium">{pendingPhone}</span> gestuurd.</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        maxLength={6}
                        className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        type="button"
                        onClick={verifyPhoneCode}
                        disabled={isVerifying || verifyCode.length !== 6}
                        className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
                      >
                        {isVerifying ? "Controleren…" : "Bevestigen"}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-blue-600">
                      {verifyTimer > 0 ? (
                        <span>Nieuwe code in {verifyTimer}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={resendVerificationCode}
                          className="font-semibold hover:underline"
                        >
                          Nieuwe code versturen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPhoneVerifyStep("idle")}
                        className="text-blue-500 hover:underline"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
                {phoneVerifyStep === "verified" && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Telefoonnummer succesvol geverifieerd!
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Verificatiestatus</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${profile?.email_auto_verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500"}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {profile?.email_auto_verified ? "E-mail geverifieerd" : "E-mail niet geverifieerd"}
                  </span>
                  <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${profile?.phone_verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500"}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {profile?.phone_verified ? "Telefoon geverifieerd" : "Telefoon niet geverifieerd"}
                  </span>
                  {isFullyVerified(profile) && (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      Geverifieerd
                    </span>
                  )}
                  {isPartiallyVerified(profile) && (
                    <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                      Gedeeltelijk geverifieerd
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Privacyinstellingen</p>
                <p className="mb-3 text-xs text-stone-400">Bepaal welke contactgegevens zichtbaar zijn voor anderen op Welkthuis.</p>
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-sm text-stone-700">E-mailadres zichtbaar voor anderen</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showEmail}
                      onClick={() => setShowEmail((v) => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${showEmail ? "bg-rose-500" : "bg-stone-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showEmail ? "translate-x-5" : "translate-x-0.5"}`}
                      />
                    </button>
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-sm text-stone-700">Telefoonnummer zichtbaar voor anderen</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showPhone}
                      onClick={() => setShowPhone((v) => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${showPhone ? "bg-rose-500" : "bg-stone-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showPhone ? "translate-x-5" : "translate-x-0.5"}`}
                      />
                    </button>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                data-testid="profile-save"
                className="w-full rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Opslaan…
                  </span>
                ) : "Profiel opslaan"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Profieltype — one-time selector for users who skipped onboarding */}
      {!loading && (
        <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-base font-semibold text-stone-900">Je profieltype</p>
          {profile?.user_type ? (
            <>
              <p className="mt-1 mb-4 text-sm text-stone-500">Je profieltype is ingesteld en kan niet worden gewijzigd.</p>
              {(() => {
                const persona = PROFILE_PERSONAS[profile.user_type as UserType];
                if (!persona) return null;
                return (
                  <div className="inline-flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
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
            <>
              <p className="mt-1 mb-5 text-sm text-stone-500">
                Je hebt je profieltype nog niet ingesteld. Kies wat het beste bij je past — dit kan daarna niet meer worden gewijzigd.
              </p>

              <div
                className="transition-opacity duration-200"
                style={{ opacity: personaAnimating ? 0 : 1 }}
              >
                {personaStep === 1 && (
                  <div className="grid gap-3">
                    {/* Verhuurder */}
                    <button
                      type="button"
                      disabled={savingPersona}
                      onClick={async () => {
                        if (!supabase || !user) return;
                        setSavingPersona(true);
                        const { error } = await supabase.from("profiles").update({ user_type: "verhuurder" }).eq("id", user.id);
                        setSavingPersona(false);
                        if (error) { toast.error("Opslaan mislukt. Probeer het opnieuw."); return; }
                        setProfile((prev) => prev ? { ...prev, user_type: "verhuurder" } : prev);
                        toast.success("Je profieltype is opgeslagen.");
                      }}
                      className="group flex items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 transition group-hover:bg-amber-100">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-bold text-stone-900 group-hover:text-amber-600">Verhuurder</p>
                        <p className="mt-0.5 text-xs text-stone-500">Ik verhuur kamers of woningen</p>
                      </div>
                      {savingPersona ? (
                        <svg className="h-4 w-4 shrink-0 animate-spin text-stone-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                    {/* Woningzoekende → step 2 */}
                    <button
                      type="button"
                      disabled={savingPersona}
                      onClick={() => {
                        setPersonaAnimating(true);
                        setTimeout(() => { setPersonaStep(2); setPersonaAnimating(false); }, 200);
                      }}
                      className="group flex items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition group-hover:bg-rose-100">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-bold text-stone-900 group-hover:text-rose-600">Woningzoekende</p>
                        <p className="mt-0.5 text-xs text-stone-500">Ik zoek een woning voor mezelf</p>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {/* Huisgenoot zoeker */}
                    <button
                      type="button"
                      disabled={savingPersona}
                      onClick={async () => {
                        if (!supabase || !user) return;
                        setSavingPersona(true);
                        const { error } = await supabase.from("profiles").update({ user_type: "huisgenoot_zoeker" }).eq("id", user.id);
                        setSavingPersona(false);
                        if (error) { toast.error("Opslaan mislukt. Probeer het opnieuw."); return; }
                        setProfile((prev) => prev ? { ...prev, user_type: "huisgenoot_zoeker" } : prev);
                        toast.success("Je profieltype is opgeslagen.");
                      }}
                      className="group flex items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 transition group-hover:bg-blue-100">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-bold text-stone-900 group-hover:text-blue-600">Huisgenoot zoeker</p>
                        <p className="mt-0.5 text-xs text-stone-500">Ik zoek iemand om mee samen te wonen</p>
                      </div>
                      {savingPersona ? (
                        <svg className="h-4 w-4 shrink-0 animate-spin text-stone-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}

                {personaStep === 2 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonaAnimating(true);
                        setTimeout(() => { setPersonaStep(1); setPersonaAnimating(false); }, 200);
                      }}
                      className="mb-4 inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Terug
                    </button>
                    <p className="mb-3 text-sm font-semibold text-stone-700">Hoe wil je wonen?</p>
                    <div className="grid gap-3">
                      {([
                        { key: "student" as UserType,       label: "Student",             desc: "Ik studeer en zoek een kamer of studio" },
                        { key: "professional" as UserType,  label: "Professional / Expat",desc: "Ik werk en zoek een appartement of kamer" },
                        { key: "alleenstaande" as UserType, label: "Alleenstaande",        desc: "Ik zoek een woning voor mezelf" },
                        { key: "family" as UserType,        label: "Familie",             desc: "Wij zoeken een woning als gezin" },
                      ]).map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          disabled={savingPersona}
                          onClick={async () => {
                            if (!supabase || !user) return;
                            setSavingPersona(true);
                            const { error } = await supabase.from("profiles").update({ user_type: key }).eq("id", user.id);
                            setSavingPersona(false);
                            if (error) { toast.error("Opslaan mislukt. Probeer het opnieuw."); return; }
                            setProfile((prev) => prev ? { ...prev, user_type: key } : prev);
                            toast.success("Je profieltype is opgeslagen.");
                          }}
                          className="group flex items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition group-hover:bg-rose-100">
                            <span className="text-xl leading-none">{PROFILE_PERSONAS[key]?.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-sm font-bold text-stone-900 group-hover:text-rose-600">{label}</p>
                            <p className="mt-0.5 text-xs text-stone-500">{desc}</p>
                          </div>
                          {savingPersona && (
                            <svg className="h-4 w-4 shrink-0 animate-spin text-stone-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Notification preferences — separate card, saves immediately on toggle */}
      {!loading && profile && (
        <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-base font-semibold text-stone-900">Notificatievoorkeuren</p>
          <p className="mt-1 mb-5 text-sm text-stone-500">Bepaal voor welke activiteiten je een melding wilt ontvangen.</p>
          <div className="flex flex-col divide-y divide-stone-100">

            {/* Nieuwe berichten */}
            <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">Nieuwe berichten</p>
                  <p className="text-xs text-stone-400">Melding bij een nieuw chatbericht van een andere gebruiker.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifyNewMessage}
                onClick={() => handleNotifToggle("notify_new_message", !notifyNewMessage)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${notifyNewMessage ? "bg-rose-500" : "bg-stone-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifyNewMessage ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Aanvraag updates */}
            <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Bell className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">Aanvraag updates</p>
                  <p className="text-xs text-stone-400">Melding als je aanvraag wordt geaccepteerd of afgewezen.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifyApplicationUpdate}
                onClick={() => handleNotifToggle("notify_application_update", !notifyApplicationUpdate)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${notifyApplicationUpdate ? "bg-rose-500" : "bg-stone-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifyApplicationUpdate ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Nieuwe woningen */}
            <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50">
                  <Search className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">Nieuwe woningen</p>
                  <p className="text-xs text-stone-400">Melding als een nieuwe woning overeenkomt met je opgeslagen zoekopdracht.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifyMatchingListing}
                onClick={() => handleNotifToggle("notify_matching_listing", !notifyMatchingListing)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${notifyMatchingListing ? "bg-rose-500" : "bg-stone-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifyMatchingListing ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Wachtwoord wijzigen */}
      {!loading && user && (
        <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 shrink-0 text-stone-500" />
            <p className="text-base font-semibold text-stone-900">Wachtwoord wijzigen</p>
          </div>
          <p className="mt-1 mb-5 text-sm text-stone-500">Werk je wachtwoord bij voor extra beveiliging. Gebruik minimaal 8 tekens.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-stone-700">Huidig wachtwoord</label>
              <div className="mt-1.5">
                <PasswordInput
                  value={pwCurrent}
                  onChange={(e) => { setPwCurrent(e.target.value); setPwErrors((p) => ({ ...p, current: undefined })); }}
                  placeholder="••••••••"
                  className={pwErrors.current ? "border-rose-400 bg-rose-50" : ""}
                />
              </div>
              {pwErrors.current && <p className="mt-1 text-xs text-rose-500">{pwErrors.current}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">Nieuw wachtwoord</label>
              <div className="mt-1.5">
                <PasswordInput
                  value={pwNew}
                  onChange={(e) => { setPwNew(e.target.value); setPwErrors((p) => ({ ...p, new: undefined })); }}
                  placeholder="Minimaal 8 tekens"
                  className={pwErrors.new ? "border-rose-400 bg-rose-50" : ""}
                />
              </div>
              {pwNew && (() => {
                const strength = getPasswordStrength(pwNew);
                const segments = [
                  strength >= 1
                    ? strength === 1 ? "bg-rose-500" : strength === 2 ? "bg-amber-400" : "bg-emerald-500"
                    : "bg-stone-200",
                  strength >= 2
                    ? strength === 2 ? "bg-amber-400" : "bg-emerald-500"
                    : "bg-stone-200",
                  strength >= 3 ? "bg-emerald-500" : "bg-stone-200",
                ];
                const label = strength === 1 ? "Zwak" : strength === 2 ? "Matig" : "Sterk";
                const labelColor = strength === 1 ? "text-rose-500" : strength === 2 ? "text-amber-500" : "text-emerald-600";
                return (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {segments.map((cls, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${cls}`} />
                      ))}
                    </div>
                    <p className={`mt-1 text-xs font-medium ${labelColor}`}>{label}</p>
                  </div>
                );
              })()}
              {pwErrors.new && <p className="mt-1 text-xs text-rose-500">{pwErrors.new}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">Bevestig nieuw wachtwoord</label>
              <div className="mt-1.5">
                <PasswordInput
                  value={pwConfirm}
                  onChange={(e) => { setPwConfirm(e.target.value); setPwErrors((p) => ({ ...p, confirm: undefined })); }}
                  placeholder="Herhaal nieuw wachtwoord"
                  className={pwErrors.confirm ? "border-rose-400 bg-rose-50" : ""}
                />
              </div>
              {pwErrors.confirm && <p className="mt-1 text-xs text-rose-500">{pwErrors.confirm}</p>}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={pwPending}
              onClick={handlePasswordChange}
              className="flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-stone-700 disabled:opacity-50 active:scale-[0.98]"
            >
              {pwPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Bijwerken…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Wachtwoord bijwerken
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Danger zone — account deletion */}
      {!loading && user && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <p className="text-base font-semibold text-stone-900">Account verwijderen</p>
          </div>
          <p className="mt-2 text-sm text-stone-500">
            Je account permanent verwijderen. Deze actie kan niet ongedaan worden gemaakt. Al je gegevens worden definitief verwijderd volgens de AVG/GDPR richtlijnen.
          </p>
          <button
            type="button"
            onClick={() => { setDeleteEmail(""); setDeletePassword(""); setShowDeleteModal(true); }}
            className="mt-4 rounded-2xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 active:scale-[0.98]"
          >
            Account verwijderen
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900">Weet je zeker dat je je account wilt verwijderen?</h2>
                <p className="mt-1.5 text-sm text-stone-500">
                  Dit is permanent. Je verliest al je listings, berichten, favorieten, en verificaties. Deze actie kan <span className="font-semibold text-red-600">NIET</span> ongedaan worden gemaakt.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="delete-email" className="text-xs font-medium text-stone-700">
                  Bevestig je e-mailadres
                </label>
                <input
                  id="delete-email"
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder={user?.email ?? "jij@example.nl"}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div>
                <label htmlFor="delete-password" className="text-xs font-medium text-stone-700">
                  Wachtwoord ter bevestiging
                </label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="w-full rounded-2xl border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 sm:w-auto"
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
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50 active:scale-[0.98] sm:w-auto"
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
        </div>
      )}
    </div>
  );
}
