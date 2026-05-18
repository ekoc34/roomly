import { useRef, useState, useTransition } from "react";
import { Link } from "wouter";
import { ShieldCheck, ShieldX, Clock, Upload, Lock, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import type { IdentityDocumentType } from "@/types/database";

const DOC_TYPES: { value: IdentityDocumentType; label: string; description: string }[] = [
  { value: "passport", label: "Paspoort", description: "Geldige biometrische Nederlandse of buitenlandse paspoort" },
  { value: "id_card", label: "Identiteitskaart", description: "Geldig Europees identiteitsbewijs" },
  { value: "residence_permit", label: "Verblijfsvergunning", description: "Geldige verblijfsvergunning (IND-sticker of I-document)" },
  { value: "drivers_license", label: "Rijbewijs", description: "Geldig Europees of Nederlands rijbewijs" },
];

const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function StatusPanel({ status, rejectionReason, onResubmit }: {
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  onResubmit: () => void;
}) {
  if (status === "approved") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-emerald-900">Identiteit geverifieerd</h2>
        <p className="mt-2 text-sm text-emerald-700">
          Je identiteit is geverifieerd. Het keurmerk is zichtbaar op jouw advertenties.
        </p>
        <Link
          href="/kamers/nieuw"
          className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Advertentie plaatsen →
        </Link>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-amber-900">Verificatie in behandeling</h2>
        <p className="mt-2 text-sm text-amber-700">
          Je document is ontvangen en wordt beoordeeld. Dit duurt doorgaans 1–2 werkdagen.
          Je ontvangt een bericht zodra het klaar is.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
        >
          Terug naar dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100">
          <ShieldX className="h-6 w-6 text-rose-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-rose-900">Verificatie afgewezen</h2>
          {rejectionReason ? (
            <p className="mt-1 text-sm text-rose-700">
              Reden: <span className="font-medium">{rejectionReason}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-rose-700">
              Het ingediende document kon niet worden goedgekeurd. Controleer of het document geldig en goed leesbaar is.
            </p>
          )}
          <button
            type="button"
            onClick={onResubmit}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Opnieuw indienen
          </button>
        </div>
      </div>
    </div>
  );
}

export function VerificationPage() {
  const { user, loading: authLoading } = useAuth();
  const { verification, loading: verifLoading, refetch } = useIdentityVerification();
  const [isPending, startTransition] = useTransition();
  const [selectedDocType, setSelectedDocType] = useState<IdentityDocumentType>("passport");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = authLoading || verifLoading;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError("Alleen JPEG, PNG, WebP of PDF is toegestaan.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`Bestand mag maximaal ${MAX_SIZE_MB} MB zijn.`);
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setFileError(null);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError("Alleen JPEG, PNG, WebP of PDF is toegestaan.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`Bestand mag maximaal ${MAX_SIZE_MB} MB zijn.`);
      return;
    }
    setFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setSubmitError("Selecteer een document om te uploaden."); return; }
    setSubmitError(null);

    startTransition(async () => {
      if (!supabase || !user) { setSubmitError("Niet ingelogd."); return; }

      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("identity-documents")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadErr) {
        if (uploadErr.message?.includes("Bucket not found") || uploadErr.message?.includes("bucket")) {
          setSubmitError(
            "De opslag voor documenten is nog niet geconfigureerd. Neem contact op met de beheerder."
          );
        } else {
          setSubmitError("Upload mislukt: " + uploadErr.message);
        }
        return;
      }

      const { error: insertErr } = await supabase.from("identity_verifications").insert({
        user_id: user.id,
        status: "pending",
        document_type: selectedDocType,
        document_path: path,
        submitted_at: new Date().toISOString(),
      });

      if (insertErr) {
        await supabase.storage.from("identity-documents").remove([path]);
        if (insertErr.code === "23505") {
          setSubmitError("Je hebt al een verificatie lopen. Wacht op de beoordeling.");
        } else {
          setSubmitError("Indienen mislukt: " + insertErr.message);
        }
        return;
      }

      toast.success("Document ingediend! Je ontvangt een bericht zodra het beoordeeld is.");
      setFile(null);
      setShowForm(false);
      refetch();
    });
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je identiteit te verifiëren</h1>
        <Link
          href="/inloggen?next=/verificatie"
          className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600"
        >
          Inloggen
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
      </div>
    );
  }

  const hasStatus = verification !== null;
  const canShowForm = !hasStatus
    || verification?.status === "rejected"
    || showForm;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Identiteitsverificatie</span>
      </nav>

      <h1 className="text-2xl font-bold text-stone-900">Identiteitsverificatie</h1>
      <p className="mt-1 text-sm text-stone-500">
        Verhuurders en adverteerders verifiëren hun identiteit voordat ze een advertentie plaatsen. Zo is Welkthuis veiliger voor iedereen.
      </p>

      <div className="mt-6 space-y-5">

        {/* Status panel — show when there's an existing verification */}
        {hasStatus && !showForm && (
          <StatusPanel
            status={verification!.status}
            rejectionReason={verification!.rejection_reason}
            onResubmit={() => setShowForm(true)}
          />
        )}

        {/* Privacy reassurance — always visible */}
        <div className="rounded-2xl border border-stone-100 bg-stone-50 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Privacy & veiligheid</p>
          <ul className="space-y-2.5 text-sm text-stone-600">
            <li className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <span>Jouw document wordt <strong>nooit publiek getoond</strong> en is alleen toegankelijk voor bevoegde medewerkers van Welkthuis.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <span>We controleren alleen of je identiteit echt is. We slaan geen BSN of volledige documentgegevens op.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <span>Na goedkeuring verschijnt het keurmerk <strong>"Identiteit geverifieerd"</strong> op jouw advertenties.</span>
            </li>
          </ul>
        </div>

        {/* Upload form — show when no status or rejected or explicitly triggered */}
        {canShowForm && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">
              {verification?.status === "rejected" ? "Opnieuw indienen" : "Document indienen"}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Stap 1: kies het type document. Stap 2: upload een duidelijke foto of scan.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-6">

              {/* Document type */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-700">Documenttype *</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DOC_TYPES.map((dt) => (
                    <label
                      key={dt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                        selectedDocType === dt.value
                          ? "border-rose-300 bg-rose-50 ring-1 ring-rose-300"
                          : "border-stone-200 bg-white hover:bg-stone-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="doc_type"
                        value={dt.value}
                        checked={selectedDocType === dt.value}
                        onChange={() => setSelectedDocType(dt.value)}
                        className="mt-0.5 accent-rose-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-stone-800">{dt.label}</p>
                        <p className="text-xs text-stone-500">{dt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* File upload */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-700">Document uploaden *</p>
                <label
                  htmlFor="id-doc-upload"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition ${
                    file
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-stone-300 bg-stone-50 hover:border-rose-300 hover:bg-rose-50/50"
                  }`}
                >
                  {file ? (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <FileText className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-stone-800">{file.name}</p>
                        <p className="text-xs text-stone-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <span className="text-xs text-emerald-600 underline">Kies een ander bestand</span>
                    </>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200">
                        <Upload className="h-5 w-5 text-stone-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-stone-700">Klik om te uploaden of sleep het bestand hierheen</p>
                        <p className="text-xs text-stone-400">JPEG, PNG, WebP of PDF · max {MAX_SIZE_MB} MB</p>
                      </div>
                    </>
                  )}
                  <input
                    id="id-doc-upload"
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>

                {fileError && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {fileError}
                  </p>
                )}
              </div>

              {/* Tips */}
              <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3 text-xs text-stone-500 space-y-1">
                <p className="font-medium text-stone-600">Tips voor een goede foto:</p>
                <p>· Zorg dat alle vier de hoeken van het document zichtbaar zijn</p>
                <p>· Goede belichting — geen flitser reflectie</p>
                <p>· Tekst moet goed leesbaar zijn</p>
                <p>· Geen selfie met het document — leg het plat neer</p>
              </div>

              {submitError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending || !file}
                className="w-full rounded-xl bg-rose-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.99]"
              >
                {isPending ? "Bezig met indienen…" : "Document indienen"}
              </button>

              <p className="text-center text-xs text-stone-400">
                Door in te dienen ga je akkoord met onze{" "}
                <Link href="/privacy" className="underline hover:text-stone-600">privacyverklaring</Link>.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
