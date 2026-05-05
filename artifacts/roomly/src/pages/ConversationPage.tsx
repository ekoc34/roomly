import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ChatComposer } from "@/components/messages/ChatComposer";
import type { Conversation, Listing, Message, Profile } from "@/types/database";

export function ConversationPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", params.id).order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    if (user) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", params.id).neq("sender_id", user.id).is("read_at", null);
    }
  }, [params.id, user]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    async function fetchAll() {
      const { data: conv } = await supabase!.from("conversations").select("*, listing:listing_id(*), tenant:tenant_id(*), landlord:landlord_id(*)").eq("id", params.id).maybeSingle();
      if (!conv) { setLoading(false); return; }
      setConversation(conv as Conversation);
      setListing((conv as { listing: Listing | null }).listing);
      const otherId = (conv as Conversation).tenant_id === user?.id ? (conv as Conversation).landlord_id : (conv as Conversation).tenant_id;
      const { data: otherProfile } = await supabase!.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(otherProfile as Profile | null);
      await fetchMessages();
      setLoading(false);
    }
    fetchAll();

    if (!supabase) return;
    const channel = supabase
      .channel(`conversation:${params.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${params.id}` }, () => { fetchMessages(); })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [params.id, user, fetchMessages]);

  if (loading) {
    return <div className="flex h-full items-center justify-center py-24 text-sm text-stone-500">Laden…</div>;
  }

  if (!conversation) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Gesprek niet gevonden</h1>
        <Link href="/berichten" className="mt-6 inline-block text-sm text-rose-600 hover:underline">Terug naar berichten</Link>
      </div>
    );
  }

  const initial = (other?.name ?? other?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-0 px-4 py-4 sm:px-6">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <Link href="/berichten" data-testid="conversation-back" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-600 hover:border-rose-200 hover:text-rose-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
          {other?.avatar_url ? <img src={other.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-semibold text-stone-500">{initial}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">{other?.name ?? "Gebruiker"}</p>
          {listing && <Link href={`/kamers/${listing.id}`} className="truncate text-xs text-stone-500 hover:text-rose-600">{listing.title}</Link>}
        </div>
      </div>

      <div className="min-h-[300px] space-y-3 pb-4">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-stone-400">Nog geen berichten. Stuur als eerste een bericht!</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const time = new Date(msg.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`} data-testid={`message-${msg.id}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${isMine ? "rounded-br-sm bg-rose-500 text-white" : "rounded-bl-sm bg-white text-stone-900 border border-stone-200"}`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
                <p className={`mt-1 text-right text-[10px] ${isMine ? "text-white/60" : "text-stone-400"}`}>{time}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {user && (
        <div className="sticky bottom-[4.5rem] rounded-2xl border border-stone-200/80 bg-white p-3 shadow-md md:bottom-4">
          <ChatComposer conversationId={conversation.id} onSent={fetchMessages} />
        </div>
      )}
    </div>
  );
}
