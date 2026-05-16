# Roomly — Storage, Bandwidth & Operational Abuse Audit

**Date:** 2026-05-16  
**Scope:** Full source review of `artifacts/roomly/src/`, `supabase/migrations/`, `supabase/functions/`  
**Severity scale:** CRITICAL · HIGH · MEDIUM · LOW

---

## Summary table

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| S-01 | Storage | No cleanup when a listing is deleted — images orphaned forever | HIGH | Open |
| S-02 | Storage | No cleanup when an account is deleted — avatar orphaned | HIGH | Open |
| S-03 | Storage | Eager upload before form submit — orphaned files on tab close | MEDIUM | Open |
| S-04 | Storage | No per-user storage quota | MEDIUM | Open |
| S-05 | Storage | Avatar URL stored with `?t=Date.now()` — CDN cache always bypassed | MEDIUM | Open |
| S-06 | Storage | Listing images served at original size — no server-side resize | MEDIUM | Open |
| S-07 | Storage | Public bucket + predictable avatar path enables mass harvesting | LOW | Open |
| D-01 | Database | `ListingsPage` has no `.limit()` — unbounded full-table SELECT | HIGH | Open |
| D-02 | Database | `fetchMessages` has no row limit — full history on every reconnect | HIGH | Open |
| D-03 | Database | Missing GIN/trgm indexes on `ilike` search columns | HIGH | Open |
| D-04 | Database | `?verified=1` fires unbounded secondary profiles query | MEDIUM | Open |
| D-05 | Database | N+1: profile enrichment is a separate query after listing fetch | MEDIUM | Open |
| D-06 | Database | Missing indexes on frequently-filtered boolean/enum columns | MEDIUM | Open |
| D-07 | Database | `fetchMessages` refetches entire thread on every realtime event | MEDIUM | Open |
| D-08 | Database | `saved_searches` INSERT bypasses RPC — no server-side filter validation | LOW | Open |
| R-01 | Realtime | `useUnreadMessages` subscribes globally — N users × 1 message = N DB queries | HIGH | Open |
| R-02 | Realtime | `ConversationPage` block channel uses `Date.now()` — channel churn | LOW | Open |
| R-03 | Realtime | Admin dashboard: unfiltered subscriptions on report tables | LOW | Open |
| A-01 | Auth | `email_auto_verified: true` writable client-side by any authenticated user | HIGH | Open |
| A-02 | Auth | No CAPTCHA — automated account creation possible | MEDIUM | Open |
| A-03 | Auth | OAuth account farming with disposable Google accounts | LOW | Open |
| E-01 | External API | MapPage fires up to 200 Nominatim requests per page load | HIGH | Open |
| E-02 | Edge Fn | `stripe-checkout` has no idempotency key — duplicate sessions possible | LOW | Open |
| E-03 | Edge Fn | `notify_saved_search_matches` called fire-and-forget from client | LOW | Open |
| I-01 | Infra | Leaflet marker icons loaded from unpkg.com — external production dependency | LOW | Open |

---

## SECTION S — Supabase Storage

---

### S-01 · HIGH — No cleanup when a listing is deleted

**Exploitability:** Any authenticated user.

**Attack scenario:**
1. Register account.
2. Create listing, upload 6 × 10 MB images (60 MB per listing).
3. Delete listing via dashboard.
4. Repeat. Files in `listings/{uid}/` accumulate indefinitely with no DB record pointing to them.
5. At scale: 100 accounts × 100 cycles = 60 GB of unreachable, undetectable orphaned storage.

**Root cause:**
The `delete` action on `listings` (whether via direct RLS or a future RPC) has no cascade into Supabase Storage. The `create_listing` and `update_listing` RPCs only touch the `listings` table row. Storage files are entirely outside the database transaction scope.

**Backend fix — SQL trigger or RPC:**
Add an AFTER DELETE trigger on `listings` that calls `storage.delete()` via a pg_net HTTP call, OR — more reliably — add a cleanup step to the delete-listing flow:

```sql
-- Option A: add delete_listing RPC that cleans storage via pg_net
CREATE OR REPLACE FUNCTION public.delete_listing(p_listing_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_images   TEXT[];
  v_img      TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT images INTO v_images
    FROM public.listings
   WHERE id = p_listing_id AND user_id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;

  -- Delete row first (RLS-safe)
  DELETE FROM public.listings WHERE id = p_listing_id AND user_id = v_user_id;

  -- Caller is responsible for deleting storage objects client-side using the
  -- returned images array, or use a background job / Edge Function.
  -- pg_net approach:
  --   FOREACH v_img IN ARRAY v_images LOOP
  --     PERFORM net.http_delete(url := ...) ...
  --   END LOOP;
END;
$$;
```

**Frontend fix:**
Replace the direct `.delete()` call with `supabase.rpc("delete_listing", { p_listing_id })`. After success, iterate `listing.images` and call `supabase.storage.from("listings").remove([storagePath])` for each URL.

**Storage policy fix:**
Add a lifecycle policy or nightly Edge Function that queries storage for paths with no corresponding `listings` row and deletes them.

---

### S-02 · HIGH — No cleanup when an account is deleted

**Exploitability:** Any user exercising the delete-account flow.

**Attack scenario:** Same as S-01 but amplified — deleting an account also leaves all listing images AND the avatar at `avatars/{uid}/avatar.jpg` unreachable. The `delete-user` Edge Function calls `adminClient.auth.admin.deleteUser(userId)` which fires the `handle_new_user` trigger in reverse (if a DELETE trigger exists), but no storage cleanup is performed.

**Backend fix:**
In the `delete-user` Edge Function, after `adminClient.auth.admin.deleteUser(userId)` succeeds, list and delete all objects in `avatars/{userId}/` and `listings/{userId}/` using the service-role storage client:

```typescript
// Inside delete-user/index.ts — after successful auth deletion
const { data: avatarFiles } = await adminStorageClient.storage
  .from("avatars")
  .list(userId);
if (avatarFiles?.length) {
  await adminStorageClient.storage
    .from("avatars")
    .remove(avatarFiles.map((f) => `${userId}/${f.name}`));
}

const { data: listingFiles } = await adminStorageClient.storage
  .from("listings")
  .list(userId);
if (listingFiles?.length) {
  await adminStorageClient.storage
    .from("listings")
    .remove(listingFiles.map((f) => `${userId}/${f.name}`));
}
```

---

### S-03 · MEDIUM — Eager upload before form submit — orphaned files on tab close

**Exploitability:** Any user (unintentional or deliberate).

**Attack scenario:**
1. Open `/kamers/nieuw`.
2. Upload 6 images — they are uploaded to `listings/{uid}/{timestamp}-{rand}.{ext}` immediately.
3. Close the tab without submitting.
4. Files persist in storage. `sessionStorage` (which held the URLs) is gone.
5. Repeat daily → unbounded storage growth with no listing row, no way to associate files.

**Root cause:**
`ListingImageUpload` uploads each file the moment it is selected. The `sessionStorage` key `roomly_new_listing_images` only persists URLs across tab switches, not tab closes. There is no cleanup hook on component unmount.

**Fix options (choose one):**
- **Option A (preferred):** Upload images only on form submit, not on selection. Buffer files in component state as `File` objects, upload as part of `onSubmit` before the `create_listing` RPC call.
- **Option B:** On component unmount (when the user navigates away from the form without submitting), delete any uploaded files that are not yet associated with a listing. Track them in a `useRef` inside `NewListingPage` and delete in the cleanup return of the `useEffect`.
- **Option C:** Run a nightly storage audit function that deletes `listings/{uid}/` files older than 24h that have no corresponding listing row.

---

### S-04 · MEDIUM — No per-user storage quota

**Exploitability:** Any authenticated user willing to create many listings.

**Attack scenario:** A user creates 100 listings over time, each with 6 × 10 MB images = 6 GB of storage consumed by one account. With the free-tier listing cap temporarily disabled (`create_listing` RPC comment: "Free-tier listing cap: temporarily disabled"), there is no server-side gate on listing count either.

**Fix:**
Add a per-user storage check in `create_listing` RPC or a dedicated storage quota function:

```sql
-- In create_listing, after ownership checks:
SELECT COALESCE(SUM(octet_length(url)), 0) / (1024*1024)
INTO v_used_mb
FROM unnest(
  (SELECT array_agg(unnest) FROM public.listings, unnest(images)
   WHERE user_id = v_user_id)
) AS url;
IF v_used_mb > 500 THEN  -- 500 MB per user
  RAISE EXCEPTION 'STORAGE_QUOTA_EXCEEDED';
END IF;
```

Alternatively, enforce at the storage bucket level via Supabase Storage bucket policies (size_limit per folder).

---

### S-05 · MEDIUM — Avatar stored with `?t=Date.now()` — CDN cache always bypassed

**Exploitability:** Passive — affects all users with avatars.

**Attack scenario:** Not a direct attack, but a cost amplification. Every page that renders a user's avatar (listings page, conversation page, dashboard) fetches the avatar directly from Supabase Storage origin because the URL contains a unique timestamp query string. No CDN (Supabase's included CDN or any downstream cache) will cache a URL with a changing `?t=` parameter.

**Root cause:**
`AvatarUpload.tsx` line 88:
```typescript
const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
```
This is stored into `profiles.avatar_url` permanently. The intent was to bust the browser's local cache after upload, but the timestamp is now stored, not just used temporarily for the preview.

**Fix:**
```typescript
// Bust only the local preview; store the clean URL in the database
const publicUrl = data.publicUrl;           // ← stored in DB (CDN-cacheable)
const previewUrl = `${publicUrl}?t=${Date.now()}`; // ← used for local preview only
setPreview(previewUrl);

await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
onUploaded(previewUrl); // local component can still show the busted version
```

---

### S-06 · MEDIUM — Listing images served at full upload size

**Exploitability:** Passive cost amplification via normal usage.

**Attack scenario:** A landlord uploads 6 × 8 MB photos. A listing detail page with a carousel serves 48 MB to every visitor. With 1,000 monthly visitors per listing, that is 48 GB of egress per listing per month, billed at Supabase's egress rate.

**Root cause:** Unlike avatars (which are resized to 256×256 client-side before upload), listing images in `ListingImageUpload` are uploaded at their original resolution and size.

**Fix:**
Apply client-side resize before upload in `ListingImageUpload`, similar to the `cropAndResizeImage` function in `AvatarUpload`. Target 1200px wide at 85% JPEG quality — sufficient for property photos and reduces a 8 MB photo to ~300 KB.

```typescript
async function resizeListingImage(file: File, maxPx = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")),
        "image/jpeg", 0.85);
    };
    img.onerror = reject;
    img.src = url;
  });
}
```

---

### S-07 · LOW — Public bucket + predictable avatar paths enable mass harvesting

**Exploitability:** Any unauthenticated caller who can collect user UUIDs.

**Attack scenario:**
1. Scrape `/kamers` (public, no auth) to collect all `user_id` fields from listings.
2. For each UUID, fetch `{SUPABASE_URL}/storage/v1/object/public/avatars/{uuid}/avatar.jpg`.
3. Build a database of all user photos without ever touching the Supabase API or triggering RLS.

**Fix:**
- Short-term: no action required if privacy policy permits public avatars, but document the exposure.
- Medium-term: if user privacy is important, generate signed URLs server-side for avatar access instead of using the public bucket URL directly. Or switch `avatars` to a private bucket and serve through an Edge Function that verifies the session.

---

## SECTION D — Database

---

### D-01 · HIGH — `ListingsPage` has no `.limit()` — unbounded full-table SELECT

**Exploitability:** Any browser visiting `/kamers`, including unauthenticated bots.

**Attack scenario:**
1. Send a GET request to the Supabase REST endpoint for `listings` with the anon key (extracted from the public bundle).
2. Or simply navigate to `/kamers` — `ListingsPage` fires `supabase.from("listings").select("*")` with no LIMIT.
3. With 10,000 listings, this returns all 10,000 rows (or PostgREST's default 1,000, whichever is smaller) on every page load.
4. Each row includes the full `images` text[] array — potentially 6 × ~512 char URLs each.
5. Rapid polling of this endpoint by bots exhausts Supabase's compute quota.

**Root cause:**
`ListingsPage.tsx` line 93 builds a dynamic query but never calls `.limit(n)`.

**Fix:**
```typescript
// Apply a hard cap. UI can add a "Load more" / page number control.
const PAGE_SIZE = 50;
const page = Number(params.get("page") ?? 1);
query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
```
Also enforce a hard `LIMIT 200` in Supabase PostgREST config (`db-max-rows`) as a safety net.

---

### D-02 · HIGH — `fetchMessages` has no row limit

**Exploitability:** Users in long-running conversations; could be deliberate flooding.

**Attack scenario:**
1. Two accounts exchange 10,000 messages over 6 months (or a bot sends the allowed 20/min for hours).
2. Every time either user opens the conversation or the realtime channel fires an event, `fetchMessages()` retrieves all 10,000 rows.
3. On a mobile connection, this is a multi-MB transfer on every new message.

**Root cause:**
`ConversationPage.tsx` line 84: `supabase.from("messages").select("*").eq("conversation_id", id).order("created_at")` — no `.limit()`.

**Fix:**
```typescript
// Load the last 100 messages; load more on scroll up
const { data } = await supabase
  .from("messages")
  .select("*")
  .eq("conversation_id", params.id)
  .order("created_at", { ascending: false })
  .limit(100);
const msgs = ((data ?? []) as Message[]).reverse();
setMessages(msgs);
```
On realtime INSERT, append only the new message to state rather than re-fetching the full thread.

---

### D-03 · HIGH — Missing GIN/trgm indexes on `ilike` search columns

**Exploitability:** Any visitor using the search bar or scraping search endpoints.

**Attack scenario:**
1. Every search request fires:
   ```
   .or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`)
   ```
2. A leading-wildcard `ILIKE '%keyword%'` cannot use a B-tree index — forces a sequential scan of the full `listings` table on every keystroke-triggered search.
3. A bot sending 100 search requests per second causes 100 simultaneous seqscans, saturating the database.

**Fix — SQL migration:**
```sql
-- Enable trigram extension (once per project)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for free-text search
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON public.listings USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_description_trgm
  ON public.listings USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_location_trgm
  ON public.listings USING GIN (location gin_trgm_ops);
```

For the `?city=` filter specifically (exact city match), a plain B-tree on `location` would also help and is cheaper to maintain.

---

### D-04 · MEDIUM — `?verified=1` fires unbounded secondary profiles query

**Exploitability:** Any visitor appending `?verified=1` to the listings URL.

**Attack scenario:**
1. As the platform grows to 50,000 verified users, `?verified=1` returns 50,000 profile rows (all with `email_auto_verified=true AND phone_verified=true`) — only to extract their UUIDs for a subsequent `.in()` clause.
2. The `.in()` clause itself can then exceed PostgREST's URL length limit or Supabase's operator limits.

**Root cause:**
`ListingsPage.tsx` lines 84–90: fetches all verified profile IDs with no limit.

**Fix:**
Replace the client-side two-query approach with a server-side join. Either:
- Add a computed column `is_verified boolean GENERATED ALWAYS AS (email_auto_verified AND phone_verified) STORED` to `profiles`, then join listings to profiles in a view or RPC.
- Or rewrite the listings query to join profiles inline:
  ```typescript
  // Use PostgREST foreign-key filtering
  query = query.eq("profiles.email_auto_verified", true)
               .eq("profiles.phone_verified", true);
  // (requires the FK relationship to be registered in Supabase)
  ```

---

### D-05 · MEDIUM — N+1: profile enrichment is a separate second query

**Exploitability:** Passive performance issue amplified by the missing limit in D-01.

**Root cause:**
`ListingsPage.tsx` lines 132–149: after fetching listings, a second query fetches owner profiles. While this is not a true N+1 (it uses `.in()` to batch), it is 2 round-trips per page load and cannot be server-side cached as a unit.

**Fix:**
Use PostgREST's embedded resource syntax to fetch profiles in one query:
```typescript
let query = supabase
  .from("listings")
  .select("*, owner:profiles!user_id(id, verification_badge, avg_response_time_hours, name, avatar_url, show_avatar_in_listings)");
```
This produces one SQL query with a LEFT JOIN and halves the round-trip count.

---

### D-06 · MEDIUM — Missing indexes on filter columns

**Exploitability:** Users applying common filters; bots enumerating combinations.

The following columns are frequently queried with equality filters but have no visible index in the migrations:

| Column | Query type |
|--------|-----------|
| `listings.pets_allowed` | `eq(true)` |
| `listings.smoking_allowed` | `eq(true)` |
| `listings.gender_preference` | `eq("vrouw"/"man"/"gemengd")` |
| `listings.type` | `eq("room_for_rent"/"short_stay"/"roommate_search")` |
| `profiles.email_auto_verified` + `phone_verified` | `eq(true) AND eq(true)` |
| `messages.read_at` + `sender_id` | IS NULL + neq (in unread count query) |
| `conversations.tenant_id` / `landlord_id` | eq (in unread messages fetch) |

**Fix — SQL migration:**
```sql
CREATE INDEX IF NOT EXISTS idx_listings_type        ON public.listings (type);
CREATE INDEX IF NOT EXISTS idx_listings_pets        ON public.listings (pets_allowed) WHERE pets_allowed = true;
CREATE INDEX IF NOT EXISTS idx_listings_smoking     ON public.listings (smoking_allowed) WHERE smoking_allowed = true;
CREATE INDEX IF NOT EXISTS idx_listings_gender      ON public.listings (gender_preference) WHERE gender_preference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_verified    ON public.profiles (email_auto_verified, phone_verified)
  WHERE email_auto_verified = true AND phone_verified = true;
CREATE INDEX IF NOT EXISTS idx_messages_unread      ON public.messages (conversation_id, sender_id, read_at)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_convs_tenant         ON public.conversations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_convs_landlord       ON public.conversations (landlord_id);
```

---

### D-07 · MEDIUM — `fetchMessages` is called on every realtime event

**Exploitability:** Any two users in an active chat; cost grows with message volume.

**Root cause:**
`ConversationPage.tsx` lines 170–171:
```typescript
.on("postgres_changes", { event: "INSERT", ... }, () => { fetchMessages(); })
```
`fetchMessages()` re-fetches the entire conversation (no limit — see D-02) on every INSERT. This means a conversation with 1,000 messages refetches all 1,000 rows every time a new message arrives.

**Fix:**
Use the realtime payload directly for INSERT events — the new message is in `payload.new`:
```typescript
.on("postgres_changes", { event: "INSERT", ... }, (payload) => {
  setMessages((prev) => [...prev, payload.new as Message]);
  setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
})
```
Only call `fetchMessages()` on initial load or reconnect, not on every new message.

---

### D-08 · LOW — `saved_searches` INSERT bypasses RPC

**Exploitability:** Low — the trigger cap (20 rows) limits damage.

**Root cause:**
`ListingsPage.tsx` line 205 inserts directly into `saved_searches` with arbitrary JSONB in the `filters` field. No server-side validation of filter keys or values. A manually crafted request could store `{ "__proto__": ... }` or arbitrarily large JSON.

**Fix:**
Add a `create_saved_search(p_name TEXT, p_filters JSONB)` RPC that validates `p_filters` keys against the known filter whitelist (`q`, `city`, `type`, `district`, `min`, `max`, `pets`, `smoking`, `gender`, `rooms`, `min_surface`, `sort`, `verified`) before inserting.

---

## SECTION R — Realtime

---

### R-01 · HIGH — `useUnreadMessages` subscribes globally — N × 1 message = N DB queries

**Exploitability:** Scales automatically with concurrent users. No attacker action required.

**Attack scenario:**
1. 200 users are online and have the header mounted (so `useUnreadMessages` is active for all 200).
2. One user sends a message.
3. The Supabase Realtime server broadcasts the `messages:INSERT` event.
4. Because the subscription has **no filter**, all 200 clients receive the event.
5. All 200 clients call `fetchUnread()` simultaneously.
6. `fetchUnread()` performs two queries each:
   - `SELECT id FROM conversations WHERE tenant_id = ? OR landlord_id = ?`
   - `SELECT COUNT(*) FROM messages WHERE conversation_id IN (...) AND read_at IS NULL`
7. **Result: 1 message = 400 simultaneous DB queries.**

**Root cause:**
`useUnreadMessages.ts` lines 66–79: no `filter:` option on the `.on("postgres_changes", ...)` call.

**Fix:**
Add a server-side filter so each client only receives events for their own conversations. Since PostgREST realtime filters are limited to simple equality, the cleanest approach is to subscribe to a user-specific channel using a DB function notification, or filter on `sender_id`:

```typescript
// Subscribe only to messages sent BY others, filtered to this user's conversations
// Requires a "conversation_participant" view or denormalised column.
// Simplest working fix — filter on sender_id not being us:
const channel = supabase
  .channel(channelName)
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "messages",
    // NOTE: PostgREST filter syntax — limits broadcast to messages not from self
    // This still broadcasts to all clients; proper fix is a NOTIFY-based approach
  }, () => { fetchUnread(); })
```

**Proper fix:** Use a Postgres `NOTIFY` trigger on `messages` that sends `user_id` of recipient, and subscribe to a user-specific channel `unread:{user_id}` so Supabase only pushes to the relevant client. This reduces fan-out from O(N users) to O(1) per message.

**Interim fix (reduces load by ~80%):**
Debounce `fetchUnread` with a 2-second window so rapid message bursts only cause one query:
```typescript
const debouncedFetch = useMemo(
  () => debounce(fetchUnread, 2000, { leading: false, trailing: true }),
  [fetchUnread]
);
```

---

### R-02 · LOW — Block channel uses `Date.now()` — channel churn risk

**Root cause:**
`ConversationPage.tsx` line 244:
```typescript
const blockChannel = supabase.channel(`block:${user.id}:${other.id}:${Date.now()}`)
```
A new channel name is created on every effect run. The cleanup is in place but if `other` changes before cleanup fires (e.g., rapid navigation), stale channels accumulate until the Supabase client is garbage-collected.

**Fix:**
Remove `Date.now()` — use a stable name identical to the one used in `useUnreadMessages`:
```typescript
const blockChannel = supabase.channel(`block:${user.id}:${other.id}`)
```

---

### R-03 · LOW — Admin dashboard: unfiltered subscriptions on three tables

**Root cause:**
The admin dashboard subscribes to `INSERT` on `listing_reports`, `user_reports`, and `contact_messages` with no filter. Any insert to these tables is broadcast to every open admin session.

**Impact:** Low (admin sessions are rare, and these tables are insert-only), but each broadcast causes a full stats re-fetch.

**Fix:** Add `filter: \`created_at=gt.${adminOpenedAt}\`` or a per-admin notification channel to avoid re-fetching on events that were already shown.

---

## SECTION A — Authentication & Account Abuse

---

### A-01 · HIGH — `email_auto_verified: true` writable client-side by any authenticated user

**Exploitability:** Any authenticated user via direct Supabase JS SDK call.

**Attack scenario:**
1. Register any account (email/password or OAuth).
2. Call: `supabase.from("profiles").update({ email_auto_verified: true }).eq("id", myUserId)`
3. The profiles RLS UPDATE policy (`auth.uid() = id`) allows this.
4. The account now shows a verification badge on all listings and gets priority in verified-only searches, without ever verifying a real email or phone.

**Root cause:**
`OAuthProfileHandler.tsx` line 98 writes `email_auto_verified: true` in a plain `.upsert()`. This reveals that the column is writable by the owner via RLS. The same RLS policy that allows OAuth users to set this field also allows any user to set it manually.

**Fix:**
1. Remove `email_auto_verified` from the list of user-updatable profile columns by restricting the UPDATE RLS policy to a whitelist of safe columns. Supabase does not natively support column-level RLS, so the fix is to move `email_auto_verified` writes into a `SECURITY DEFINER` RPC that validates the request:

```sql
-- Replace direct column update with an RPC
CREATE OR REPLACE FUNCTION public.set_email_verified_from_oauth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_provider TEXT;
BEGIN
  -- Only callable by the user themselves
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;

  -- Verify the caller actually used an OAuth provider
  SELECT raw_app_meta_data->>'provider' INTO v_provider
    FROM auth.users WHERE id = p_user_id;

  IF v_provider NOT IN ('google', 'facebook') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  UPDATE public.profiles SET email_auto_verified = true WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_email_verified_from_oauth(UUID) TO authenticated;
```

2. In `OAuthProfileHandler.tsx`, replace:
```typescript
email_auto_verified: true,
```
with:
```typescript
// email_auto_verified is set server-side via RPC
await supabase.rpc("set_email_verified_from_oauth", { p_user_id: user.id });
```

3. Add a `REVOKE UPDATE (email_auto_verified, phone_verified, verification_badge, role, subscription_tier, boost_credits, scam_flagged) ON public.profiles FROM authenticated;` to lock down these sensitive columns entirely from direct client writes. All writes to these columns must go through SECURITY DEFINER RPCs.

---

### A-02 · MEDIUM — No CAPTCHA — automated account creation

**Exploitability:** Any scripted HTTP client.

**Attack scenario:**
1. Script calls `POST /auth/v1/signup` with generated emails and a fixed password.
2. Each signup triggers the `handle_new_user` DB trigger (profile row creation).
3. Accounts can then spam listings, messages, or contact forms.
4. Supabase's built-in rate limiting (3 signups/hour/IP on free tier) provides some defense, but is bypassable with rotating IPs or using the OAuth flow.

**Fix:**
- Enable Supabase's built-in CAPTCHA integration (hCaptcha or Turnstile) in the Auth settings.
- This requires no code changes — it is configured in the Supabase Dashboard under Authentication → Settings → Bot and Abuse Protection.

---

### A-03 · LOW — OAuth account farming with disposable Google accounts

**Exploitability:** Low effort — Google account creation is free.

**Attack scenario:**
1. Create throwaway Gmail accounts.
2. Register via "Login met Google" — bypasses any email-based blocking.
3. Each OAuth account auto-receives `email_auto_verified: true` (see A-01), giving it a head start.

**Fix:**
- Enforce phone verification for accounts that want to post listings (already in the UX, should be the RPC-level gate).
- Consider blocking signups from known disposable email domains.
- The Supabase CAPTCHA fix in A-02 does NOT cover OAuth — Google's own bot detection on account creation is the primary defense here.

---

## SECTION E — External APIs & Edge Functions

---

### E-01 · HIGH — MapPage fires up to 200 Nominatim requests per page load

**Exploitability:** Any user visiting `/kaart`.

**Attack scenario:**
1. User visits `/kaart` — MapPage fetches up to 200 listings.
2. For every listing whose location string doesn't match the hardcoded `CITY_COORDS` dictionary, `geocodeNominatim()` is called.
3. A listing with location `"Vondelstraat 45, Amsterdam-Oud-West"` doesn't match `"amsterdam"` in the dict (it does, actually, because it checks `lower.includes(city)`) — but custom districts, buildings, or unusual location strings would miss.
4. `Promise.all()` fires all unrecognized geocoding requests simultaneously.
5. Nominatim's usage policy requires: User-Agent header identifying the application, max 1 request/second, no bulk geocoding.
6. Nominatim may rate-limit or permanently block the platform's IP range.

**Additional risk:**
The `geocodeCache` is a module-level `Map` — it persists across re-renders of the same component instance but is reset on navigation. Every new visit to `/kaart` re-geocodes all listings.

**Fix:**
- **Short-term:** Add a `User-Agent` header: `{ "User-Agent": "Welkthuis.nl/1.0 housing-platform@welkthuis.nl" }` (Nominatim ToS requirement).
- **Medium-term:** Persist geocoding results to the `listings` table (add `lat NUMERIC` and `lon NUMERIC` columns). Populate them on listing creation via a server-side geocoding call. The MapPage then needs no client-side geocoding at all.
- **Long-term:** If the `lat`/`lon` columns approach is used, drop the client-side Nominatim integration entirely.

**SQL migration for coordinates:**
```sql
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lon NUMERIC(9,6);

CREATE INDEX IF NOT EXISTS idx_listings_coords ON public.listings (lat, lon)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;
```

---

### E-02 · LOW — `stripe-checkout` has no idempotency key

**Exploitability:** Network errors or impatient users clicking the payment button twice.

**Root cause:**
`stripe-checkout/index.ts` calls `stripe.checkout.sessions.create(...)` with no `idempotencyKey`. A double-click or network retry creates two separate Stripe sessions, one of which will be abandoned (wasting a potential checkout URL and causing confusion in Stripe's dashboard).

**Fix:**
```typescript
const idempotencyKey = `checkout-${userId}-${packageId}-${Math.floor(Date.now() / 30000)}`;
// 30-second window: same user + package within 30s reuses the same session
const session = await stripe.checkout.sessions.create(
  { /* ... existing params ... */ },
  { idempotencyKey }
);
```

---

### E-03 · LOW — `notify_saved_search_matches` called fire-and-forget from client

**Exploitability:** Low — `ON CONFLICT DO NOTHING` prevents duplicate notifications.

**Root cause:**
`NewListingPage.tsx` line 211:
```typescript
void supabase?.rpc("notify_saved_search_matches", { p_listing_id: listingId });
```
If the user refreshes the page at exactly the redirect moment, or if the RPC is somehow called twice, it runs the 500-row cursor scan twice. The `ON CONFLICT DO NOTHING` prevents duplicate notifications, but the DB compute is wasted.

**Risk:** The RPC scans up to 500 saved searches and can insert up to 100 notifications. While capped, it still runs inline with listing creation and adds ~50–200ms latency.

**Fix:**
Move the notification dispatch to an AFTER INSERT trigger on `listings`:
```sql
CREATE OR REPLACE FUNCTION public.after_listing_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.notify_saved_search_matches(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_listing_created
  AFTER INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.after_listing_created();
```
Remove the client-side `void supabase?.rpc(...)` call entirely.

---

## SECTION I — Infrastructure

---

### I-01 · LOW — Leaflet marker icons loaded from `unpkg.com`

**Root cause:**
`MapPage.tsx` lines 12–14 hardcode:
```typescript
iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
```
These are production assets loaded from a public CDN with no SRI hash and no fallback.

**Impact:** If unpkg is slow, blocked (e.g., in corporate networks), or retired, map markers break silently.

**Fix:**
Copy the marker PNG files into `artifacts/roomly/public/leaflet/` and reference them with absolute paths:
```typescript
iconUrl: "/leaflet/marker-icon.png",
shadowUrl: "/leaflet/marker-shadow.png",
```

---

## Prioritised remediation backlog

### Immediate (before next production push)

1. **A-01** — Add SECURITY DEFINER RPC for `email_auto_verified`; revoke direct writes on sensitive profile columns.
2. **D-01** — Add `.range()` pagination to `ListingsPage` — this is also a UX improvement.
3. **D-03** — Run the `pg_trgm` + GIN index migration in Supabase SQL Editor.
4. **R-01** — Debounce `fetchUnread` as an interim fix; plan the NOTIFY-based channel approach.

### Short-term (within 2 weeks)

5. **S-01 / S-02** — Implement `delete_listing` RPC with storage cleanup; add storage cleanup to `delete-user` Edge Function.
6. **S-05** — Fix avatar URL cache-buster stored in database.
7. **S-06** — Add client-side resize to `ListingImageUpload` before upload.
8. **D-02 / D-07** — Limit `fetchMessages` to last 100; use realtime payload for append instead of full refetch.
9. **D-06** — Run the filter column index migration.
10. **E-01** — Add `User-Agent` header to Nominatim immediately; add `lat`/`lon` columns to listings.

### Medium-term (within 1 month)

11. **S-03** — Switch `ListingImageUpload` to submit-time upload.
12. **D-04 / D-05** — Rewrite listing query with embedded profile join.
13. **A-02** — Enable Supabase CAPTCHA in Dashboard settings.
14. **E-03** — Move `notify_saved_search_matches` to an AFTER INSERT trigger.
15. **I-01** — Self-host Leaflet marker assets.
