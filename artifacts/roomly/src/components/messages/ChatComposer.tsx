import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { pingLastActive } from "@/hooks/useLastActive";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { trackEvent } from "@/lib/plausible";

type Props = {
  conversationId: string;
  recipientId?: string;
  landlordId?: string;
  tenantId?: string;
  onSent?: () => void;
  isLocked?: boolean;
  blockedMessage?: string;
  onTyping?: (isTyping: boolean) => void;
};

async function maybeUpdateResponseTime(
  conversationId: string,
  landlordId: string,
  tenantId: string,
) {
  if (!supabase) return;

  // Fetch all messages in this conversation, oldest first
  const { data: msgs } = await supabase
    .from("messages")
    .select("sender_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!msgs || msgs.length === 0) return;

  const landlordMsgs = msgs.filter((m) => m.sender_id === landlordId);
  const tenantMsgs   = msgs.filter((m) => m.sender_id === tenantId);

  // Only count if this is the landlord's FIRST reply and tenant has at least one message
  if (landlordMsgs.length !== 1 || tenantMsgs.length === 0) return;

  const tenantFirstAt = new Date(tenantMsgs[0].created_at).getTime();
  const responseHours = (Date.now() - tenantFirstAt) / (1000 * 60 * 60);

  // Fetch existing avg
  const { data: profileData } = await supabase
    .from("profiles")
    .select("avg_response_time_hours")
    .eq("id", landlordId)
    .maybeSingle();

  const existing = (profileData as { avg_response_time_hours: number | null } | null)
    ?.avg_response_time_hours ?? null;

  const newAvg = existing != null
    ? (existing + responseHours) / 2
    : responseHours;

  await supabase
    .from("profiles")
    .update({ avg_response_time_hours: Math.round(newAvg * 10) / 10 })
    .eq("id", landlordId);
}

export function ChatComposer({
  conversationId,
  recipientId,
  landlordId,
  tenantId,
  onSent,
  isLocked = false,
  blockedMessage,
  onTyping,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    onTyping?.(false);
  }, [onTyping]);

  if (blockedMessage) {
    return (
      <div className="space-y-2">
        <textarea
          disabled
          rows={1}
          placeholder={blockedMessage}
          className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-100 px-4 py-2.5 text-sm text-stone-400 placeholder:text-stone-400 cursor-not-allowed opacity-60"
        />
        <p className="flex items-center gap-1.5 px-1 text-xs text-stone-500">
          <svg className="h-3.5 w-3.5 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          {blockedMessage}
        </p>
      </div>
    );
  }

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
    stopTyping();
    startTransition(async () => {
      if (!supabase || !user) { toast.error("Niet ingelogd."); return; }
      const { error: err } = await supabase.rpc("send_message", {
        p_conversation_id: conversationId,
        p_body: body,
      });
      if (err) {
        if (err.message?.includes("RATE_LIMITED")) {
          toast.error("Te veel berichten. Wacht even en probeer opnieuw.");
        } else {
          toast.error("Versturen mislukt. Probeer opnieuw.");
        }
        return;
      }
      trackEvent("message_sent");
      pingLastActive(user.id);
      formRef.current?.reset();
      setRows(1);
      onSent?.();

      // Fire-and-forget: update landlord's avg response time on first reply
      if (landlordId && tenantId && user.id === landlordId) {
        maybeUpdateResponseTime(conversationId, landlordId, tenantId).catch(() => {});
      }
    });
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split("\n").length;
    setRows(Math.min(lines, 5));

    if (e.target.value.trim()) {
      onTyping?.(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
      stopTyping();
    }
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
