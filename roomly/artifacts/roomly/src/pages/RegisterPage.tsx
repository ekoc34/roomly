import { useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PasswordInput } from "@/components/ui/password-input";

export function RegisterPage() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    
    let hasError = false;
    if (!name) { setNameError("Vul je naam in."); hasError = true; }
    if (!email) { setEmailError("Vul je e-mailadres in."); hasError = true; }
    if (password.length < 8) { setPasswordError("Wachtwoord moet minimaal 8 tekens zijn."); hasError = true; }
    if (password !== confirm) { setConfirmError("Wachtwoorden komen niet overeen."); hasError = true; }
    if (hasError) return;
    
    startTransition(async () => {
      if (!supabase) { setError("Supabase is niet geconfigureerd."); return; }
      const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (err) { 
        if (err.message.includes("email")) {
          setEmailError("Dit e-mailadres is al in gebruik.");
        } else {
          setError(err.message);
        }
        return; 
      }
      if (data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, email, name });
      }
      navigate("/welkom");
    });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-md">
        <div className="text-center">
          <p className="text-3xl font-black text-rose-600">Roomly</p>
          <h1 className="mt-2 text-xl font-bold text-stone-900">Account aanmaken</h1>
          <p className="mt-1 text-sm text-stone-500">Gratis — altijd</p>
        </div>
        {!isSupabaseConfigured() && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Supabase is niet geconfigureerd. Voeg <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> en <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> toe als omgevingsvariabelen.
          </div>
        )}
        <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
          <div>
            <label htmlFor="reg-name" className="text-xs font-medium text-stone-700">Naam</label>
            <input 
              id="reg-name" 
              name="name" 
              type="text" 
              required 
              data-testid="register-name" 
              className={`mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 ${nameError ? "border-red-300 focus:border-red-500 focus:ring-red-200" : ""}`}
              placeholder="Voornaam Achternaam" 
            />
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </div>
          <div>
            <label htmlFor="reg-email" className="text-xs font-medium text-stone-700">E-mailadres</label>
            <input 
              id="reg-email" 
              name="email" 
              type="email" 
              required 
              autoComplete="email" 
              data-testid="register-email" 
              className={`mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 ${emailError ? "border-red-300 focus:border-red-500 focus:ring-red-200" : ""}`}
              placeholder="jij@example.nl" 
            />
            {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
          </div>
          <PasswordInput
            id="reg-password"
            name="password"
            label="Wachtwoord"
            required
            minLength={8}
            placeholder="Min. 8 tekens"
            autoComplete="new-password"
            error={passwordError}
          />
          <PasswordInput
            id="reg-confirm"
            name="confirm"
            label="Herhaal wachtwoord"
            required
            minLength={8}
            placeholder="Herhaal wachtwoord"
            autoComplete="new-password"
            error={confirmError}
          />
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" disabled={isPending || !isSupabaseConfigured()} data-testid="register-submit" className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]">
            {isPending ? "Bezig…" : "Account aanmaken"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-stone-500">
          Al een account?{" "}
          <Link href="/inloggen" data-testid="register-login-link" className="font-medium text-rose-600 hover:underline">Inloggen →</Link>
        </p>
      </div>
    </div>
  );
}
