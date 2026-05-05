# Roomly — Product Requirements Document

## Original problem statement
Roomly is een marketplace voor kamers/woningen in Nederland. Gestart als student-only platform (Amsterdam), nu uitgebreid naar algemeen publiek (studenten, professionals, expats, families). Gebouwd op Next.js 16 + Supabase (free tier).

## Architecture
- **Frontend**: Next.js 16 (App Router, RSC) + React 19 + Tailwind CSS 4 + TypeScript at `/app/frontend`
- **Backend**: Supabase (PostgreSQL + Auth + Storage + RLS) at `https://gjjwctzgkujtlegcvxwy.supabase.co`
- **Helper backend**: Minimal FastAPI stub at `/app/backend` (only for supervisor compatibility, port 8001)
- **Node**: 22.x (required by Next.js 16)

## User personas
1. **Student** — searching for student housing, auto-verified via .edu/.nl university email
2. **Professional / Expat** — looking for apartment/room, often short-stay
3. **Family** — looking for full home together
4. **Landlord** — listing rooms or apartments

## Core requirements (static)
- Free for tenants AND landlords (no subscriptions)
- Works for general audience (no longer student-only)
- Trust through verification: auto-verify university emails, future phone verify
- In-app communication (chat between landlord ↔ tenant per listing)
- Favorieten (saved listings)
- Listing reports / flagging
- Mobile-first responsive

## What's implemented (Jan 2026 — v2 milestone)
- ✅ Codebase migrated to /app/frontend with supervisor-compatible config
- ✅ Database schema v2 (`002_roomly_v2.sql`):
  - profiles enriched with name, avatar_url, bio, phone, phone_verified, email_auto_verified, user_type
  - favorites table + RLS
  - conversations + messages tables + RLS
  - listing_reports table + RLS
  - avatars storage bucket
  - Auto-verify trigger for .edu/.nl university emails
- ✅ Redesign: from "student-only Amsterdam" → "voor iedereen in Nederland"
- ✅ Hero copy + WhyRoomly + Footer + OnboardingBanner all updated for general audience
- ✅ Removed fake view counts from dashboard (real "Berichten ontvangen" stat instead)
- ✅ Replaced "Coming soon" disabled buttons with working quick filters (Kamers / Kort verblijf / Tot €800)
- ✅ ListingCard with FavoriteButton (heart toggle)
- ✅ /favorieten page (saved listings)
- ✅ /berichten + /berichten/[id] (in-app chat with composer)
- ✅ Listing detail: ContactButton (start conversation) + FavoriteButton + ReportListingButton modal
- ✅ Header: Berichten link with unread badge, Favorieten link
- ✅ Mobile bottom nav: Home, Zoeken, Favorieten, Berichten, Account
- ✅ /profiel page with name/bio/phone/avatar/user_type form
- ✅ /welkom persona selector now persists to backend (was localStorage)
- ✅ /welkom redirects to /inloggen if not authenticated
- ✅ LoginForm/RegisterForm hardened with method="post" to prevent pre-hydration password leak

## Tested & verified (iteration 1)
- Public surface 100%: homepage, /kamers, /inloggen, /registreren, mobile nav, protected-route redirects, signup API
- Authenticated surface NOT YET verified — requires user to (a) disable Supabase email confirmation OR seed users with email_confirmed_at + (b) seed listings table

## P0 (next session)
- E2E test of authenticated flows (favorites, messaging, profile, dashboard, reports)

## P1 backlog
- Email notifications (Resend/SendGrid) when application/message received
- Phone verification (Twilio) for landlords
- Map-based search (Mapbox/Leaflet)
- Real-time message updates (Supabase Realtime channels)
- Avatar upload (use avatars bucket — currently URL only)
- ID document verification

## P2 / Growth
- Referral program
- Listing boost / featured (paid)
- Roommate matching algorithm
- University partnership integrations
- PWA / mobile app
- Email digest of new listings

## File structure highlights
```
/app/frontend/
  src/app/
    page.tsx                              # homepage
    kamers/page.tsx, [id]/page.tsx        # browse + detail
    favorieten/page.tsx                   # ✨ NEW
    berichten/page.tsx, [id]/page.tsx     # ✨ NEW chat
    (protected)/
      dashboard/page.tsx                  # updated, no fake views
      profiel/page.tsx                    # ✨ NEW
    welkom/page.tsx                       # updated to redirect+persist
    actions/
      favorites.ts, messages.ts, reports.ts  # ✨ NEW
      profile.ts                          # updated with updateProfile/setUserType
  src/components/
    listings/FavoriteButton.tsx, ContactButton.tsx, ReportListingButton.tsx  # ✨ NEW
    listings/OwnerBadges.tsx              # updated with avatar/bio/phone-verified
    messages/ChatComposer.tsx             # ✨ NEW
    forms/ProfileForm.tsx                 # ✨ NEW
  supabase/migrations/
    001_roomly_schema.sql
    002_roomly_v2.sql                     # ✨ NEW (run in Supabase SQL editor)
    003_dev_seed.sql                      # ✨ NEW (optional seed)
```

## Known limitations
- Real-time chat is currently poll/refresh-based (Supabase Realtime channels not yet wired)
- No email notifications yet
- No phone verification flow yet (only DB column exists)
- Avatar upload is URL-input only (no file picker — bucket exists)
