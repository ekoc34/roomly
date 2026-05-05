import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ChatComposer } from "@/components/messages/ChatComposer";
import type { Message } from "@/types/database";

type ConvMeta = {
  listing_id: string;
  listing_title: string;
  other_name: string | null;
  other_avatar: string | null;
};

export function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [meta, setMeta] = useState<ConvMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    if (!supabase || !id || !user) return;
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);

    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("conversation_id", id).neq("sender_id", user.id).is("read_at", null);
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate(`/inloggen?next=/berichten/${id}`); return; }
    if (!id || !supabase) { setLoading(false); return; }
    async function load() {
      const { data: conv } = await supabase!.from("conversations").select("listing_id, tenant_id, landlord_id, listings(title), tenant:profiles!conversations_tenant_id_fkey(name, avatar_url), landlord:profiles!conversations_landlord_id_fkey(name, avatar_url)").eq("id", id).maybeSingle();
      if (!conv) { setLoading(false); return; }
      const isLandlord = conv.landlord_id === user!.id;
      const other = isLandlord ? (conv as unknown as Record<string, unknown>).tenant as { name: string | null; avatar_url: string | null } | null : (conv as unknown as Record<string, unknown>).landlord as { name: string | null; avatar_url: string | null } | null;
      const listing = (conv as unknown as Record<string, unknown>).listings as { title: string } | null;
      setMeta({ listing_id: conv.listing_id, listing_title: listing?.title ?? "Advertentie", other_name: other?.name ?? null, other_avatar: other?.avatar_url ?? null });
      await loadMessages();
      setLoading(false);
    }
    load();

    const channel = supabase.channel(`conv-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, () => loadMessages())
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [id, user, authLoading]);

  if (authLoading || loading) return (
    <div className="flex h-[70vh] flex-col items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
    </div>
  );

  const initial = (meta?.other_name ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-2xl flex-col px-0 sm:px-4 sm:py-4 pb-28 md:pb-0">
      <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:rounded-t-2xl">
        <Link href="/berichten" className="text-stone-500 hover:text-rose-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
          {meta?.other_avatar ? <img src={meta.other_avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-semibold text-stone-500">{initial}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">{meta?.other_name ?? "Gebruiker"}</p>
          {meta?.listing_title && (
            <p className="truncate text-xs text-stone-500">
              Over: <Link href={`/kamers/${meta.listing_id}`} className="hover:text-rose-600">{meta.listing_title}</Link>
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-stone-50 px-4 py-5" data-testid="chat-messages">
        {messages.length === 0 && (
          <div className="py-12 text-center text-sm text-stone-400">Nog geen berichten. Stuur een bericht om het gesprek te starten.</div>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === user?.id;
          const time = new Date(m.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={m.id} data-testid={`message-${m.id}`} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${isMine ? "rounded-br-md bg-rose-500 text-white" : "rounded-bl-md bg-white text-stone-900 border border-stone-200"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-right text-[10px] ${isMine ? "text-rose-200" : "text-stone-400"}`}>{time}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="relative border-t border-stone-200 bg-white px-4 py-3 sm:rounded-b-2xl">
        <ChatComposer conversationId={id!} onSent={loadMessages} />
      </div>
    </div>
  );
}
