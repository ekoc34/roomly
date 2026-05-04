import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatComposer } from "@/components/messages/ChatComposer";
import { markConversationRead } from "@/app/actions/messages";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!getSupabaseConfig()) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/inloggen?next=/berichten/${id}`);

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, listing_id, tenant_id, landlord_id, listings(title, images)")
    .eq("id", id)
    .maybeSingle();

  if (!conv || (conv.tenant_id !== user.id && conv.landlord_id !== user.id)) {
    notFound();
  }

  // Mark incoming messages as read
  await markConversationRead(id);

  const otherUserId = conv.tenant_id === user.id ? conv.landlord_id : conv.tenant_id;
  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("name, email, avatar_url")
    .eq("id", otherUserId)
    .maybeSingle();

  const { data: messagesRaw } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const messages = (messagesRaw ?? []) as Array<{
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
  }>;

  const listing = Array.isArray(conv.listings) ? conv.listings[0] : conv.listings;

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-0 py-0 sm:px-6 sm:py-6" data-testid="conversation-page">
      <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:rounded-t-2xl sm:border sm:shadow-sm">
        <Link href="/berichten" className="text-stone-500 hover:text-rose-600" data-testid="conversation-back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-stone-100">
          {otherProfile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-stone-500">
              {(otherProfile?.name ?? otherProfile?.email ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-semibold text-stone-900">
            {otherProfile?.name ?? otherProfile?.email ?? "Gebruiker"}
          </p>
          {listing?.title && (
            <Link
              href={`/kamers/${conv.listing_id}`}
              className="truncate text-xs text-rose-600 hover:underline"
            >
              Over: {listing.title}
            </Link>
          )}
        </div>
      </div>

      <div
        className="flex flex-1 flex-col gap-2 bg-stone-50 px-4 py-6 sm:min-h-[50vh]"
        data-testid="messages-list"
      >
        {messages.length === 0 ? (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-stone-400">
            Nog geen berichten. Begin het gesprek hieronder.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                data-testid={`message-${m.id}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    mine
                      ? "rounded-br-sm bg-rose-500 text-white"
                      : "rounded-bl-sm bg-white text-stone-900 ring-1 ring-stone-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-rose-100" : "text-stone-400"}`}>
                    {new Date(m.created_at).toLocaleTimeString("nl-NL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="sticky bottom-0 border-t border-stone-200 bg-white px-4 py-3 sm:rounded-b-2xl sm:border sm:border-t-0 sm:shadow-sm">
        <ChatComposer conversationId={id} />
      </div>
    </div>
  );
}
