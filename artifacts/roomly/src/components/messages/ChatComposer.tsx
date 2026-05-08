import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";

type Props = {
  conversationId: string;
  onSent?: () => void;
  isLocked?: boolean;
};

export function ChatComposer({ conversationId, onSent, isLocked = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();

  if (isLocked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs leading-relaxed text-amber-700">
          Wacht op een reactie van de verhuurder voordat je een nieuw bericht stuurt.
        </p>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    if (!body) { toast.error("Bericht mag niet leeg zijn."); return; }
    if (body.length > MAX_MESSAGE_LENGTH) { toast.error("Bericht is te lang."); return; }
    startTransition(async () => {
      if (!supabase || !user) { toast.error("Niet ingelogd."); return; }
      const { error: err } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body });
      if (err) { toast.error("Versturen mislukt. Probeer opnieuw."); return; }
      formRef.current?.reset();
      setRows(1);
      onSent?.();
    });
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split("\n").length;
    setRows(Math.min(lines, 5));
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex items-end gap-2" data-testid="chat-composer">
      <textarea
        ref={textareaRef}
        name="body"
        data-testid="chat-input"
        required
        rows={rows}
        placeholder="Typ een bericht..."
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={handleInput}
        className="flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button
        type="submit"
        disabled={isPending}
        data-testid="chat-send-button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition hover:bg-rose-600 hover:scale-105 disabled:opacity-50 active:scale-95"
      >
        {isPending ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>
    </form>
  );
}
