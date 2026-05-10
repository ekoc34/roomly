import { useEffect, useState, useTransition } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { MessageSquare, Bell, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import type { Profile } from "@/types/database";
import { isFullyVerified, isPartiallyVerified } from "@/lib/verificationUtils";

export function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [phoneVerifyStep, setPhoneVerifyStep] = useState<"idle" | "sending" | "code" | "verified">("idle");
  const [pendingPhone, setPendingPhone] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyTimer, setVerifyTimer] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);

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
        <Link href="/inloggen" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
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
                      disabled={emailVerifySending}
                      onClick={sendEmailVerification}
                      className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      {emailVerifySending ? "Versturen…" : "Verifiëren"}
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
                    {profile?.email_auto_verified ? "Student e-mail geverifieerd" : "E-mail niet geverifieerd"}
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
    </div>
  );
}
