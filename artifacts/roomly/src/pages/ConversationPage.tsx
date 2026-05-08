import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ChatComposer } from "@/components/messages/ChatComposer";
import type { Conversation, Listing, Message, Profile } from "@/types/database";

function ConversationSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <div className="h-9 w-9 skeleton rounded-full" />
        <div className="h-10 w-10 skeleton rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 skeleton rounded-full" />
          <div className="h-3 w-1/2 skeleton rounded-full" />
        </div>
      </div>
      <div className="space-y-3 py-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`flex ${n % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <div className={`h-10 skeleton rounded-2xl ${n % 2 === 0 ? "w-48" : "w-64"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", params.id).order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    if (user) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() })
        .eq("conversation_id", params.id)
        .neq("sender_id", user.id)
        .is("read_at", null);
    }
  }, [params.id, user]);

  useEffect(() => {
    // Wait for auth to resolve before querying — avoids RLS rejecting an unauthenticated request
    if (authLoading) return;
    if (!supabase) { setLoading(false); return; }

    // Reset state so a re-run (e.g. after auth resolves) shows the skeleton, not a stale error
    setLoading(true);
    setConversation(null);

    async function fetchAll() {
      const { data: conv } = await supabase!
        .from("conversations")
        .select("*, listing:listing_id(*), tenant:tenant_id(*), landlord:landlord_id(*)")
        .eq("id", params.id)
        .maybeSingle();
      if (!conv) { setLoading(false); return; }
      setConversation(conv as Conversation);
      setListing((conv as { listing: Listing | null }).listing);
      const otherId = (conv as Conversation).tenant_id === user?.id
        ? (conv as Conversation).landlord_id
        : (conv as Conversation).tenant_id;
      const { data: otherProfile } = await supabase!.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(otherProfile as Profile | null);
      await fetchMessages();
      setLoading(false);
    }

    fetchAll();

    // Cleanup any existing channel before subscribing
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `conversation:${params.id}:${Date.now()}`;
    try {
      const channel = supabase
        .channel(channelName)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${params.id}`,
        }, () => { fetchMessages(); })
        .subscribe();
      channelRef.current = channel;
    } catch (e) {
      console.warn("Realtime conversation channel error:", e);
    }

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [params.id, user, authLoading, fetchMessages]);

  if (loading) return <ConversationSkeleton />;

  if (!conversation) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
          <svg className="h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-stone-900">Gesprek niet gevonden</h1>
        <p className="mt-2 text-sm text-stone-500">Dit gesprek bestaat niet of je hebt geen toegang.</p>
        <Link href="/berichten" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Terug naar berichten</Link>
      </div>
    );
  }

  const initial = (other?.name ?? other?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-0 px-4 py-4 sm:px-6">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <Link
          href="/berichten"
          data-testid="conversation-back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-600 transition hover:border-rose-200 hover:text-rose-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
          {other?.avatar_url
            ? <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
            : <span className="text-sm font-semibold text-stone-500">{initial}</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">{other?.name ?? "Gebruiker"}</p>
          {listing && (
            <Link href={`/kamers/${listing.id}`} className="truncate text-xs text-stone-500 transition hover:text-rose-600">
              {listing.title}
            </Link>
          )}
        </div>
      </div>

      <div className="min-h-[300px] space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-6 w-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-stone-700">Nog geen berichten</p>
            <p className="mt-1 text-xs text-stone-400">Stuur als eerste een bericht!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const time = new Date(msg.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.id}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm transition-opacity ${
                isMine
                  ? "rounded-br-sm bg-rose-500 text-white"
                  : "rounded-bl-sm border border-stone-200 bg-white text-stone-900"
              }`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
                <p className={`mt-1 text-right text-[10px] ${isMine ? "text-white/60" : "text-stone-400"}`}>{time}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {user && (() => {
        const isTenant = conversation.tenant_id === user.id;
        const tenantHasSent = messages.some(m => m.sender_id === conversation.tenant_id);
        const landlordHasReplied = messages.some(m => m.sender_id === conversation.landlord_id);
        const isLocked = isTenant && tenantHasSent && !landlordHasReplied;
        return (
          <div className="sticky bottom-[4.5rem] rounded-2xl border border-stone-200/80 bg-white p-3 shadow-md md:bottom-4">
            <ChatComposer conversationId={conversation.id} onSent={fetchMessages} isLocked={isLocked} />
          </div>
        );
      })()}
    </div>
  );
}
