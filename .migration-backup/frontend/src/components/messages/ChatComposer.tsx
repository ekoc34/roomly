"use client";

import { useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/actions/messages";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { useRouter } from "next/navigation";

export function ChatComposer({ conversationId }: { conversationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(conversationId, formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="flex items-end gap-2"
      data-testid="chat-composer"
    >
      <textarea
        name="body"
        data-testid="chat-input"
        required
        rows={1}
        placeholder="Typ een bericht..."
        maxLength={MAX_MESSAGE_LENGTH}
        className="flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-95"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
      {error && <p className="absolute -top-8 left-4 text-xs text-red-600" role="alert">{error}</p>}
    </form>
  );
}
