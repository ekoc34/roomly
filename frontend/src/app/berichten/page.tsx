import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ConvRow = {
  id: string;
  listing_id: string;
  tenant_id: string;
  landlord_id: string;
  last_message_at: string;
  listings: { title: string; images: string[] } | { title: string; images: string[] }[] | null;
};

function embedOne<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default async function BerichtenIndexPage() {
  if (!getSupabaseConfig()) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/inloggen?next=/berichten");

  const { data: convsRaw } = await supabase
    .from("conversations")
    .select("id, listing_id, tenant_id, landlord_id, last_message_at, listings(title, images)")
    .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  const convs = (convsRaw ?? []) as unknown as ConvRow[];

  // fetch unread counts per conv
  const convIds = convs.map((c) => c.id);
  const unreadMap: Record<string, number> = {};
  if (convIds.length > 0) {
    const { data: unreadRows } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .is("read_at", null);
    for (const row of (unreadRows ?? []) as { conversation_id: string }[]) {
      unreadMap[row.conversation_id] = (unreadMap[row.conversation_id] ?? 0) + 1;
    }
  }

  // fetch last message preview per conversation
  const previewMap: Record<string, string> = {};
  if (convIds.length > 0) {
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });
    for (const m of (lastMsgs ?? []) as { conversation_id: string; body: string }[]) {
      if (!previewMap[m.conversation_id]) previewMap[m.conversation_id] = m.body;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-testid="messages-inbox">
      <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
        Berichten
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Chats tussen jou en andere gebruikers over specifieke advertenties.
      </p>

      {convs.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="mt-4 text-base font-semibold text-stone-800">
            Nog geen berichten
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
            Start een gesprek door op een advertentie te klikken en
            &quot;Stuur bericht&quot; te kiezen.
          </p>
          <Link
            href="/kamers"
            className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600"
          >
            Bekijk woningen
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {convs.map((c) => {
            const listing = embedOne(c.listings);
            const unread = unreadMap[c.id] ?? 0;
            const preview = previewMap[c.id] ?? "Nog geen berichten";
            return (
              <li key={c.id}>
                <Link
                  href={`/berichten/${c.id}`}
                  data-testid={`conversation-${c.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:border-rose-200 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100">
                    {listing?.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                    ) : (
                      <svg className="h-6 w-6 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-stone-900">
                        {listing?.title ?? "Advertentie"}
                      </p>
                      <span className="shrink-0 text-xs text-stone-400">
                        {new Date(c.last_message_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className={`mt-0.5 truncate text-sm ${unread > 0 ? "font-semibold text-stone-900" : "text-stone-500"}`}>
                      {preview}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                      {unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
