import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Ban, Check, CheckCheck, Flag, Unlock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChatComposer } from "@/components/messages/ChatComposer";
import { ReportModal } from "@/components/moderation/ReportModal";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import { pingLastActive } from "@/hooks/useLastActive";
import type { Conversation, Listing, Message, Profile } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

const REPORT_REASONS = ["Spam", "Ongepast gedrag", "Oplichting", "Anders"] as const;
const MSG_PAGE_SIZE = 50;

function PersonSilhouette() {
  return (
    <span className="flex h-full w-full items-center justify-center">
      <svg className="h-5 w-5 text-stone-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </span>
  );
}

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
  const { t } = useLanguage();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [showOtherPanel, setShowOtherPanel] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportConvOpen, setReportConvOpen] = useState(false);
  const reportMenuRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const blockChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!showReportMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (reportMenuRef.current && !reportMenuRef.current.contains(e.target as Node)) {
        setShowReportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReportMenu]);

  // Fetch the latest MSG_PAGE_SIZE messages and merge them into state.
  // Preserves any older messages already loaded via "load older".
  const fetchMessages = useCallback(async () => {
    if (!supabase || !user) return;

    const { data, count } = await supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: false })
      .limit(MSG_PAGE_SIZE);

    const latest = ((data ?? []) as Message[]).reverse();

    setMessages((prev) => {
      if (prev.length === 0) return latest;
      // Keep messages older than the oldest in the freshly fetched batch, then append the batch.
      const cutoff = latest[0]?.created_at ?? "";
      const older = prev.filter((m) => m.created_at < cutoff);
      return [...older, ...latest];
    });

    setHasMore((count ?? 0) > MSG_PAGE_SIZE);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    // Mark unread messages as read
    const unread = latest.filter((m) => m.sender_id !== user.id && m.read_at === null);
    if (unread.length > 0) {
      await Promise.all(
        unread.map((m) => supabase!.rpc("mark_message_read", { p_message_id: m.id }))
      );
    }
  }, [params.id, user]);

  // Load the next page of older messages (prepend to list).
  const loadOlderMessages = useCallback(async () => {
    if (!supabase || !user || messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    const oldest = messages[0];
    const scrollAnchor = topAnchorRef.current;
    const prevScrollHeight = scrollAnchor?.parentElement?.scrollHeight ?? 0;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", params.id)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(MSG_PAGE_SIZE);

    const older = ((data ?? []) as Message[]).reverse();
    setMessages((prev) => [...older, ...prev]);
    setHasMore(older.length === MSG_PAGE_SIZE);
    setLoadingOlder(false);

    // Restore scroll position so the view doesn't jump to the top.
    requestAnimationFrame(() => {
      const parent = scrollAnchor?.parentElement;
      if (parent) {
        const added = parent.scrollHeight - prevScrollHeight;
        parent.scrollTop = (parent.scrollTop ?? 0) + added;
      }
    });
  }, [params.id, user, messages, loadingOlder]);

  useEffect(() => {
    if (authLoading) return;
    if (!supabase) { setLoading(false); return; }

    setLoading(true);
    setConversation(null);
    setMessages([]);
    setHasMore(false);
    setBlockedByMe(false);
    setBlockedByOther(false);
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

      if (user && otherProfile) {
        const [{ data: byMeRows }, { data: byOtherRows }] = await Promise.all([
          supabase!
            .from("user_reports")
            .select("id")
            .eq("reporter_id", user.id)
            .eq("reported_id", otherProfile.id)
            .eq("reason", "blocked")
            .limit(1),
          supabase!
            .from("user_reports")
            .select("id")
            .eq("reporter_id", otherProfile.id)
            .eq("reported_id", user.id)
            .eq("reason", "blocked")
            .limit(1),
        ]);
        setBlockedByMe(byMeRows != null && byMeRows.length > 0);
        setBlockedByOther(byOtherRows != null && byOtherRows.length > 0);
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
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${params.id}`,
        }, (payload) => {
          // D-07: append the new message directly — no full re-fetch.
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Mark as read if it came from the other participant.
          if (user && newMsg.sender_id !== user.id && !newMsg.read_at && supabase) {
            supabase.rpc("mark_message_read", { p_message_id: newMsg.id });
          }
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        })
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
      if (blockChannelRef.current && supabase) {
        supabase.removeChannel(blockChannelRef.current);
        blockChannelRef.current = null;
      }
    };
  }, [params.id, user, authLoading, fetchMessages]);

  useEffect(() => {
    if (!supabase || !user || !other) return;

    if (blockChannelRef.current) {
      supabase.removeChannel(blockChannelRef.current);
      blockChannelRef.current = null;
    }

    try {
      const blockChannel = supabase
        .channel(`block:${user.id}:${other.id}:${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "user_reports", filter: `reporter_id=eq.${other.id}` },
          (payload) => {
            if (payload.new.reported_id === user.id && payload.new.reason === "blocked") {
              setBlockedByOther(true);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "user_reports", filter: `reporter_id=eq.${other.id}` },
          async () => {
            const { data: rows } = await supabase!
              .from("user_reports")
              .select("id")
              .eq("reporter_id", other.id)
              .eq("reported_id", user.id)
              .eq("reason", "blocked")
              .limit(1);
            setBlockedByOther(rows != null && rows.length > 0);
          }
        )
        .subscribe();
      blockChannelRef.current = blockChannel;
    } catch (e) {
      console.warn("Block status channel error:", e);
    }

    return () => {
      if (blockChannelRef.current && supabase) {
        supabase.removeChannel(blockChannelRef.current);
        blockChannelRef.current = null;
      }
    };
  }, [user, other]);

  const trackTyping = useCallback((isTyping: boolean) => {
    typingChannelRef.current?.track({ typing: isTyping });
  }, []);

  const handleBlock = useCallback(async () => {
    if (!supabase || !user || !other) return;
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: other.id,
      reason: "blocked",
    });
    if (error) { toast.error(t("conversation.actionError")); return; }
    setBlockedByMe(true);
    toast.success(t("conversation.blockSuccess"));
  }, [user, other]);

  const handleUnblock = useCallback(async () => {
    if (!supabase || !user || !other) return;
    const { error } = await supabase
      .from("user_reports")
      .delete()
      .eq("reporter_id", user.id)
      .eq("reported_id", other.id)
      .eq("reason", "blocked");
    if (error) { toast.error(t("conversation.actionError")); return; }
    setBlockedByMe(false);
    toast.success(t("conversation.unblockSuccess"));
  }, [user, other]);

  const handleReport = useCallback(async (reason: string) => {
    if (!supabase || !user || !other) return;
    setShowReportMenu(false);
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: other.id,
      reason,
    });
    if (error) { toast.error(t("conversation.actionError")); return; }
    toast.success(t("conversation.reportSuccess"));
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
        <h1 className="mt-4 text-xl font-semibold text-stone-900">{t("conversation.notFound")}</h1>
        <p className="mt-2 text-sm text-stone-500">{t("conversation.notFoundDesc")}</p>
        <Link href="/berichten" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">{t("conversation.backToMessages")}</Link>
      </div>
    );
  }

  const initial = (other?.name ?? other?.email ?? "?").slice(0, 1).toUpperCase();
  const otherIsLandlord = conversation.tenant_id === user?.id;
  const panelMode = otherIsLandlord ? "landlord" : "applicant";

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
          {other?.show_avatar_in_listings === false ? (
            <PersonSilhouette />
          ) : other?.avatar_url ? (
            <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-stone-500">{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOtherPanel(true)}
              className="truncate text-sm font-semibold text-stone-900 transition hover:text-rose-600 hover:underline"
            >
              {other?.name ?? t("conversation.unknownUser")}
            </button>

            {blockedByMe ? (
              <button
                type="button"
                title={t("conversation.unblockUserTitle")}
                onClick={handleUnblock}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
              >
                <Unlock className="h-3 w-3" />
                {t("conversation.unblockUser")}
              </button>
            ) : (
              <button
                type="button"
                title={t("conversation.blockUserTitle")}
                onClick={handleBlock}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 active:scale-95"
              >
                <Ban className="h-3 w-3" />
                {t("conversation.blockUser")}
              </button>
            )}

            <div className="relative" ref={reportMenuRef}>
              <button
                type="button"
                title={t("conversation.reportUserTitle")}
                onClick={() => setShowReportMenu((v) => !v)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-95"
              >
                <Flag className="h-3 w-3" />
                {t("conversation.reportUser")}
              </button>
              {showReportMenu && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleReport(reason)}
                      className="w-full px-4 py-2 text-left text-xs text-stone-700 transition hover:bg-rose-50 hover:text-rose-700"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setReportConvOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-95"
            >
              <Flag className="h-3 w-3" />
              {t("conversation.reportConversationBtn")}
            </button>
          </div>
          {listing && (
            <Link href={`/kamers/${listing.id}`} className="mt-0.5 block truncate text-xs text-stone-500 transition hover:text-rose-600">
              {listing.title}
            </Link>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className="min-h-[300px] space-y-3 pb-36 md:pb-4">
        {/* D-02: Load older messages */}
        <div ref={topAnchorRef} />
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
            >
              {loadingOlder ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-stone-300 border-t-rose-500" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  {t("conversation.loadOlder")}
                </>
              )}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-6 w-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-stone-700">{t("conversation.noMessages")}</p>
            <p className="mt-1 text-xs text-stone-400">{t("conversation.noMessagesFirst")}</p>
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

              {isMine && (
                <div className="mt-0.5 flex items-center gap-1 pr-0.5">
                  {isRead ? (
                    <>
                      <CheckCheck className="h-3 w-3 text-blue-500" />
                      <span className="text-[10px] text-blue-500">{t("conversation.messageRead")}</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-stone-400" />
                      <span className="text-[10px] text-stone-400">{t("conversation.messageSent")}</span>
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
        const blockedMessage = (blockedByMe || blockedByOther)
          ? t("conversation.blockedError")
          : undefined;
        return (
          <div className="sticky bottom-[4.5rem] rounded-2xl border border-stone-200/80 bg-white p-3 shadow-md md:bottom-4">
            {!blockedMessage && (
              <div className={`mb-2 flex items-center gap-1.5 transition-opacity duration-300 ${otherIsTyping ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-xs text-stone-400">{t("conversation.isTyping")}</span>
              </div>
            )}
            <ChatComposer
              conversationId={conversation.id}
              recipientId={user.id === conversation.tenant_id ? conversation.landlord_id : conversation.tenant_id}
              landlordId={conversation.landlord_id}
              tenantId={conversation.tenant_id}
              onSent={fetchMessages}
              isLocked={isLocked}
              blockedMessage={blockedMessage}
              onTyping={trackTyping}
            />
          </div>
        );
      })()}
      {reportConvOpen && conversation && user && (
        <ReportModal
          targetType="conversation"
          targetId={conversation.id}
          targetLabel={t("conversation.reportConversationLabel")}
          onClose={() => setReportConvOpen(false)}
        />
      )}
    </div>
  );
}
