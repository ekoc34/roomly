import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Ban, Check, CheckCheck, Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ChatComposer } from "@/components/messages/ChatComposer";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import { getActiveStatus } from "@/lib/landlordUtils";
import { pingLastActive } from "@/hooks/useLastActive";
import type { Conversation, Listing, Message, Profile } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [showOtherPanel, setShowOtherPanel] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!supabase) return;

    // Mark incoming messages as read BEFORE fetching, so the fetched data
    // already has read_at populated — receipts show correctly on first render.
    if (user) {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", params.id)
        .neq("sender_id", user.id)
        .is("read_at", null);
    }

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true });

    setMessages((data ?? []) as Message[]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [params.id, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!supabase) { setLoading(false); return; }

    setLoading(true);
    setConversation(null);
    if (user) pingLastActive(user.id);

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
      const { data: otherProfile } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", otherId)
        .maybeSingle();
      setOther(otherProfile as Profile | null);

      // Check if the other participant has already blocked the current user
      if (user && otherProfile) {
        const { data: blockRow } = await supabase!
          .from("user_reports")
          .select("id")
          .eq("reporter_id", otherProfile.id)
          .eq("reported_id", user.id)
          .eq("reason", "blocked")
          .maybeSingle();
        if (blockRow) setBlockedByOther(true);
      }

      await fetchMessages();
      setLoading(false);
    }

    fetchAll();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `conversation:${params.id}:${Date.now()}`;
    try {
      const channel = supabase
        .channel(channelName)
        // New messages arriving
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${params.id}`,
        }, () => { fetchMessages(); })
        // Read receipts: other user opened conversation and set read_at on our messages
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${params.id}`,
        }, (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, read_at: payload.new.read_at as string | null } : m
            )
          );
        })
        .subscribe();
      channelRef.current = channel;
    } catch (e) {
      console.warn("Realtime conversation channel error:", e);
    }

    // Typing presence channel
    if (typingChannelRef.current && supabase) {
      supabase.removeChannel(typingChannelRef.current);
      typingChannelRef.current = null;
    }
    if (supabase && user) {
      try {
        const typingChannel = supabase.channel(`typing:${params.id}`, {
          config: { presence: { key: user.id } },
        });
        typingChannel
          .on("presence", { event: "sync" }, () => {
            const state = typingChannel.presenceState<{ typing: boolean }>();
            const otherTyping = Object.entries(state).some(
              ([key, presences]) =>
                key !== user.id &&
                (presences as { typing: boolean }[]).some((p) => p.typing)
            );
            setOtherIsTyping(otherTyping);
          })
          .subscribe();
        typingChannelRef.current = typingChannel;
      } catch (e) {
        console.warn("Typing presence channel error:", e);
      }
    }

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (typingChannelRef.current && supabase) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [params.id, user, authLoading, fetchMessages]);

  const trackTyping = useCallback((isTyping: boolean) => {
    typingChannelRef.current?.track({ typing: isTyping });
  }, []);

  const handleUserAction = useCallback(async (reason: "blocked" | "reported") => {
    if (!supabase || !user || !other) return;
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: other.id,
      reason,
    });
    if (error) {
      toast.error("Actie mislukt. Probeer opnieuw.");
      return;
    }
    if (reason === "blocked") setBlockedByMe(true);
    toast.success(reason === "blocked" ? "Gebruiker geblokkeerd." : "Gebruiker gerapporteerd.");
  }, [user, other]);

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
  const otherIsLandlord = conversation.tenant_id === user?.id;
  const panelMode = otherIsLandlord ? "landlord" : "applicant";
  const activeStatus = getActiveStatus(other?.last_active_at);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-0 px-4 py-4 sm:px-6">
      {showOtherPanel && other && (
        <ApplicantProfilePanel
          profileId={other.id}
          mode={panelMode}
          viewerUserId={user?.id}
          onClose={() => setShowOtherPanel(false)}
        />
      )}

      {/* Conversation header */}
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOtherPanel(true)}
              className="truncate text-sm font-semibold text-stone-900 transition hover:text-rose-600 hover:underline"
            >
              {other?.name ?? "Gebruiker"}
            </button>
            <button
              type="button"
              title="Blokkeer gebruiker"
              onClick={() => handleUserAction("blocked")}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 active:scale-95"
            >
              <Ban className="h-3 w-3" />
              Blokkeer
            </button>
            <button
              type="button"
              title="Rapporteer gebruiker"
              onClick={() => handleUserAction("reported")}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-95"
            >
              <Flag className="h-3 w-3" />
              Rapporteer
            </button>
          </div>
          {activeStatus && (
            <p className="mt-0.5 flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${activeStatus.dot}`} />
              <span className="text-xs text-stone-500">{activeStatus.label}</span>
            </p>
          )}
          {listing && (
            <Link href={`/kamers/${listing.id}`} className="block truncate text-xs text-stone-500 transition hover:text-rose-600">
              {listing.title}
            </Link>
          )}
        </div>
      </div>

      {/* Message list */}
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
          const isRead = msg.read_at !== null;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
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

              {/* Read receipt — only for my outgoing messages */}
              {isMine && (
                <div className="mt-0.5 flex items-center gap-1 pr-0.5">
                  {isRead ? (
                    <>
                      <CheckCheck className="h-3 w-3 text-blue-500" />
                      <span className="text-[10px] text-blue-500">Gelezen</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-stone-400" />
                      <span className="text-[10px] text-stone-400">Verzonden</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {user && (() => {
        const isTenant = conversation.tenant_id === user.id;
        const tenantHasSent = messages.some(m => m.sender_id === conversation.tenant_id);
        const landlordHasReplied = messages.some(m => m.sender_id === conversation.landlord_id);
        const isLocked = isTenant && tenantHasSent && !landlordHasReplied;
        const blockedMessage = blockedByMe
          ? "Je hebt deze gebruiker geblokkeerd."
          : blockedByOther
            ? "Je kunt geen berichten sturen naar deze gebruiker."
            : undefined;
        return (
          <div className="sticky bottom-[4.5rem] rounded-2xl border border-stone-200/80 bg-white p-3 shadow-md md:bottom-4">
            {/* Typing indicator — hide when blocked */}
            {!blockedMessage && (
              <div className={`mb-2 flex items-center gap-1.5 transition-opacity duration-300 ${otherIsTyping ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-xs text-stone-400">… aan het typen</span>
              </div>
            )}
            <ChatComposer
              conversationId={conversation.id}
              recipientId={user.id === conversation.tenant_id ? conversation.landlord_id : conversation.tenant_id}
              onSent={fetchMessages}
              isLocked={isLocked}
              blockedMessage={blockedMessage}
              onTyping={trackTyping}
            />
          </div>
        );
      })()}
    </div>
  );
}
