import { useState } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

type FormState = {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const CATEGORIES = [
  { value: "suggestie", label: "Suggestie" },
  { value: "klacht", label: "Klacht" },
  { value: "vraag", label: "Vraag" },
  { value: "overig", label: "Overig" },
];

const EMPTY: FormState = { name: "", email: "", category: "", subject: "", message: "" };

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Vul je naam in.";
  if (!form.email.trim()) errors.email = "Vul je e-mailadres in.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Ongeldig e-mailadres.";
  if (!form.category) errors.category = "Kies een categorie.";
  if (!form.subject.trim()) errors.subject = "Vul een onderwerp in.";
  if (!form.message.trim()) errors.message = "Vul je bericht in.";
  return errors;
}

export function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (!supabase) {
      toast.error("Er is een configuratiefout opgetreden. Probeer het later opnieuw.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      category: form.category,
      subject: form.subject.trim(),
      message: form.message.trim(),
    });
    setSubmitting(false);

    if (error) {
      toast.error("Er is iets misgegaan. Probeer het opnieuw.");
      return;
    }

    toast.success("Je bericht is verzonden. We nemen zo snel mogelijk contact met je op!");
    setForm(EMPTY);
    setErrors({});
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100">
          <Mail className="h-5 w-5 text-rose-600" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Contact</h1>
          <p className="text-sm text-stone-500">Stel een vraag, geef feedback of meld een probleem.</p>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Send className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-stone-900">Bericht verzonden!</p>
          <p className="mt-2 text-sm text-stone-500">We nemen zo snel mogelijk contact met je op.</p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]"
          >
            Nog een bericht sturen
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Naam */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-stone-700" htmlFor="name">Je naam</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={set("name")}
                placeholder="Jan de Vries"
                className={`rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:ring-2 focus:ring-rose-400 ${errors.name ? "border-rose-400 bg-rose-50" : "border-stone-200 bg-stone-50/60"}`}
              />
              {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
            </div>

            {/* E-mail */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-stone-700" htmlFor="email">Je e-mailadres</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                placeholder="jan@voorbeeld.nl"
                className={`rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:ring-2 focus:ring-rose-400 ${errors.email ? "border-rose-400 bg-rose-50" : "border-stone-200 bg-stone-50/60"}`}
              />
              {errors.email && <p className="text-xs text-rose-500">{errors.email}</p>}
            </div>

            {/* Categorie */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-stone-700" htmlFor="category">Categorie</label>
              <select
                id="category"
                value={form.category}
                onChange={set("category")}
                className={`rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 outline-none transition focus:ring-2 focus:ring-rose-400 ${errors.category ? "border-rose-400 bg-rose-50" : "border-stone-200 bg-stone-50/60"}`}
              >
                <option value="">Kies een categorie...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-rose-500">{errors.category}</p>}
            </div>

            {/* Onderwerp */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-stone-700" htmlFor="subject">Onderwerp</label>
              <input
                id="subject"
                type="text"
                value={form.subject}
                onChange={set("subject")}
                placeholder="Korte omschrijving"
                className={`rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:ring-2 focus:ring-rose-400 ${errors.subject ? "border-rose-400 bg-rose-50" : "border-stone-200 bg-stone-50/60"}`}
              />
              {errors.subject && <p className="text-xs text-rose-500">{errors.subject}</p>}
            </div>

            {/* Bericht */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="message">Je bericht</label>
              <textarea
                id="message"
                rows={5}
                value={form.message}
                onChange={set("message")}
                placeholder="Schrijf hier je bericht..."
                className={`resize-none rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:ring-2 focus:ring-rose-400 ${errors.message ? "border-rose-400 bg-rose-50" : "border-stone-200 bg-stone-50/60"}`}
              />
              {errors.message && <p className="text-xs text-rose-500">{errors.message}</p>}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98] disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Verzenden..." : "Verstuur bericht"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
