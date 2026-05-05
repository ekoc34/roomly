# Roomly — Dutch Housing Listings Platform

## Overview

pnpm workspace monorepo using TypeScript. The main product is **Roomly**, a Dutch housing marketplace (Vite + React + Supabase). It uses path-based routing with the app served at `/`.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + Wouter (client-side routing) + Tailwind CSS v4
- **Backend / Auth / DB**: Supabase (external) — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` required
- **Styling**: Tailwind CSS v4, tw-animate-css, @tailwindcss/typography
- **API codegen**: Orval (not used by Roomly — uses Supabase SDK directly)

## Artifacts

| Artifact | Kind | Port | Preview |
|---|---|---|---|
| Roomly | web | 23714 | `/` |
| API Server | api | — | `/api` |
| Canvas | design | — | `/__mockup` |

## Key Files

```
artifacts/roomly/
  src/
    App.tsx               — Router + layout wrapper
    main.tsx              — Entry point
    index.css             — Tailwind + CSS vars (Inter font, stone-50 bg)
    index.html            — Inter font from Google Fonts
    lib/
      supabase.ts         — Supabase client (gracefully null when unconfigured)
      constants.ts        — Shared constants (LISTING_TYPE_LABELS, districts, etc.)
    hooks/
      useAuth.ts          — Auth state hook via supabase.auth.onAuthStateChange
    types/
      database.ts         — All TypeScript types (Listing, Profile, Message, etc.)
    components/
      layout/             — Header, Footer, MobileBottomNav
      home/               — HeroSearch, FeaturedListings, WhyRoomly, OnboardingBanner
      listings/           — ListingCard, FavoriteButton, ContactButton, DetailGallery,
                            OwnerBadges, ReportListingButton, SkeletonCard, StickyApplyCTA,
                            ListingFilters
      messages/           — ChatComposer
      search/             — CitySelector
      onboarding/         — UserPersonaSelector
    pages/
      HomePage, ListingsPage, ListingDetailPage, NewListingPage, EditListingPage,
      FavoritesPage, MessagesPage, ConversationPage, DashboardPage,
      ProfilePage, WelcomePage, LoginPage, RegisterPage
```

## Routes

| Path | Page |
|---|---|
| `/` | HomePage |
| `/kamers` | ListingsPage |
| `/kamers/nieuw` | NewListingPage |
| `/kamers/:id/bewerken` | EditListingPage |
| `/kamers/:id` | ListingDetailPage |
| `/favorieten` | FavoritesPage |
| `/berichten` | MessagesPage |
| `/berichten/:id` | ConversationPage |
| `/dashboard` | DashboardPage |
| `/profiel` | ProfilePage |
| `/welkom` | WelcomePage (onboarding persona selector) |
| `/inloggen` | LoginPage |
| `/registreren` | RegisterPage |

## Environment Variables Required

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key

The app handles missing Supabase config gracefully — it shows informative banners rather than crashing.

## Supabase Tables Used

- `listings` — housing ads (title, description, price, location, type, images, availability_date, user_id)
- `profiles` — user profile (id, name, email, bio, phone, avatar_url, role, user_type, verifications)
- `favorites` — (user_id, listing_id)
- `conversations` — chat threads (listing_id, tenant_id, landlord_id)
- `messages` — chat messages (conversation_id, sender_id, body, read_at)
- `listing_reports` — moderation reports (listing_id, reporter_id, category, reason)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
