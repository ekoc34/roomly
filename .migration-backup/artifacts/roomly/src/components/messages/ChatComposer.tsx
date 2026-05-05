import { useRef, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";

export function ChatComposer({ conversationId, onSent }: { conversationId: string; onSent?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { user } = useAuth();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    if (!body) { setError("Bericht mag niet leeg zijn."); return; }
    if (body.length > MAX_MESSAGE_LENGTH) { setError("Bericht is te lang."); return; }
    startTransition(async () => {
      if (!supabase || !user) { setError("Niet ingelogd."); return; }
      const { error: err } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body });
      if (err) { setError("Versturen mislukt."); return; }
      formRef.current?.reset();
      onSent?.();
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex items-end gap-2" data-testid="chat-composer">
      <textarea
        name="body"
        data-testid="chat-input"
        required
        rows={1}
        placeholder="Typ een bericht..."
        maxLength={MAX_MESSAGE_LENGTH}
        className="flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
        }}
      />
      <button type="submit" disabled={isPending} data-testid="chat-send-button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-95">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
      </button>
      {error && <p className="absolute -top-8 left-4 text-xs text-red-600" role="alert">{error}</p>}
    </form>
  );
}
