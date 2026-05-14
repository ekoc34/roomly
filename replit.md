# Roomly — Dutch Housing Listings Platform

## Run & Operate

- **Dev**: `pnpm --filter @workspace/roomly run dev` (port 23714, preview `/`)
- **Typecheck**: `pnpm run typecheck`
- **Build**: `pnpm run build`
- **Env vars required**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Stack

- **Monorepo**: pnpm workspaces, Node 24, TypeScript 5.9
- **Frontend**: React 19 + Vite 7 + Wouter + Tailwind CSS v4
- **Auth / DB**: Supabase (external) — client gracefully null when unconfigured
- **Map**: react-leaflet + leaflet + @types/leaflet
- **Notifications**: sonner (Toaster)

## Where things live

```
artifacts/roomly/src/
  App.tsx                  — Router, layout, SelectedCityProvider (app-level)
  main.tsx / index.css     — Entry point, Tailwind + CSS vars
  lib/supabase.ts          — Supabase client
  contexts/
    SelectedCityContext.tsx — DUTCH_CITIES, SelectedCityProvider, useSelectedCity
  hooks/
    useAuth.ts             — Auth state hook
    useUnreadMessages.ts   — Realtime unread badge (unique channel names)
  components/
    layout/                — Header, Footer, MobileBottomNav
    home/                  — HeroSearch (city autocomplete + context), FeaturedListings,
                             NeighborhoodSection (dynamic stadsdeel), WhyRoomly, OnboardingBanner
    listings/              — ListingCard, FavoriteButton, ContactButton, SkeletonCard, etc.
    search/                — CitySelector (context-connected), CitySearchAutocomplete
  pages/
    HomePage, ListingsPage, ListingDetailPage, NewListingPage, EditListingPage,
    FavoritesPage, MessagesPage, ConversationPage, DashboardPage,
    ProfilePage, WelcomePage, LoginPage, RegisterPage,
    ForgotPasswordPage, ResetPasswordPage, MapPage
```

Schema: `supabase/schema.sql` (run manually in Supabase SQL Editor)

## Architecture decisions

- `SelectedCityProvider` lives at `App.tsx` root so header `CitySelector` and homepage `NeighborhoodSection` share the same context instance
- `NeighborhoodSection` is hidden (`return null`) when `selectedCity === null` — appears only after user picks a city
- Vite config has `resolve.dedupe: ["react","react-dom"]` to prevent react-leaflet from bundling its own React copy
- Supabase client returns `null` when env vars are missing; all data hooks guard with `if (!supabase)`
- Routes use Dutch slugs (`/kamers`, `/berichten`, `/kaart`, etc.)

## Product

- Browse, search, and filter Dutch housing listings (rooms, apartments, short-stay)
- City-based search with autocomplete; homepage Stadsdeel section dynamically shows neighborhoods for selected city
- Auth (login/register/forgot-password/reset), user profiles with avatar upload
- Favorites, in-app messaging with real-time unread badge
- Interactive map page (`/kaart`) via react-leaflet
- Dashboard for landlords, listing CRUD

## User preferences

- All UI text in Dutch
- Tailwind v4 (no config file — CSS-first)
- After completing a task, confirm completion and stop — do NOT suggest next features or offer follow-ups

## Gotchas

- `src/contexts/` (plural) is the canonical context path — do NOT use `src/context/` (singular, deleted)
- react-leaflet requires Vite dedupe + leaflet CSS import in the page component
- migration-backup workflows always fail (expected — no node_modules there)
- Vite cache (`node_modules/.vite`) may need clearing after adding new packages

## Pointers

- Supabase schema: `supabase/schema.sql`
- Tailwind theme: `artifacts/roomly/src/index.css`
