# WSIGTE (Where Should I Go To Eat?)

A web app that picks a random restaurant, cafe, or bakery near you so you never have to argue about where to eat again. Built with [Next.js](https://nextjs.org/) and Apple's [MapKit JS](https://developer.apple.com/documentation/mapkitjs/) via [mapkit-react](https://github.com/Nicolapps/mapkit-react).

Live at **[wsigte.com](https://wsigte.com)**

## How It Works

1. On load, `pages/index.tsx` pings `${NEXT_PUBLIC_API_BASE_URL}/v1/health` first. If it returns non-2xx or a `down` status, the `DownScreen` ("BACK SOON.") renders with a **Try again** button that retries the boot sequence. Otherwise it fetches a short-lived MapKit JS JWT from `${NEXT_PUBLIC_API_BASE_URL}/v1/token` and caches it in `localStorage` until ~30s before expiry (decoded from the JWT payload). A failed token request also drops the user onto the `DownScreen` with the HTTP status code stamped in the header.
2. `mapkit-react` boots a hidden map to acquire the user's coordinates via browser geolocation. If it fails or times out (10s), the Not Found screen takes over: it offers a manual address input (the shared `AddressSearch` component, powered by `mapkit.Search.autocomplete`, debounced 200ms, min 3 chars, biased to the last known region), a "Locate me" button that retries browser geolocation, and a grid of curated neighborhood tiles that submit a geocoder lookup on tap. The neighborhood list is currently a static stub (`DISTRICTS` in `components/NotFoundScreen.tsx`) — a real API will replace it later.
3. The client `POST`s to `${NEXT_PUBLIC_API_BASE_URL}/v1/recommendations` with `{ latitude, longitude, excludedPlaceIds }`. The server returns one recommendation drawn either from a curated `top_picks` table (probabilistic — configured server-side) or from Apple's Maps Server API for nearby `Bakery | Cafe | Restaurant` POIs. The recommendation carries `name`, `address`, `latitude`, `longitude`, `appleMapsPlaceId`, and optional `blurb`. A `404` (nothing left in range — often because the user has rejected everything nearby) routes to the **No Results** screen, *not* the Not Found / "we lost you" screen: the GPS worked, so the copy owns running dry and offers a "Start over" button (clears the rejection/skip history via `clearRejections`/`clearSoftSkips` and re-rolls from the same coordinates) plus the same `AddressSearch` to look somewhere else.
4. Picks are prefetched into a small client-side **buffer** (`shared/hooks/useRecommendationQueue.ts`, target 3) so the next card is ready before the user acts — no fetch gap on a swipe. The queue fills by calling `/v1/recommendations` repeatedly, passing everything already buffered (plus the user's rejections/skips) in `excludedPlaceIds` so each call returns a distinct pick; it stops (and routes to **No Results**) only when the buffer is empty and the server has nothing left nearby. Each buffered recommendation is hydrated via `new mapkit.PlaceLookup().getPlace(appleMapsPlaceId, cb)` (`shared/recommendationHydration.ts`) to populate `telephone` and `urls` (the Apple Maps Server API doesn't expose those — only the browser-side MapKit JS does), falling back to the slim payload on a 4 s timeout. The loading screen honors a minimum duration before revealing the first card.
5. The result experience has two phases (`components/ResultScreen.tsx` routes on a `picked` flag):
   - **Browse — the swipe deck** (`framer-motion`/`motion`, no map). Each pick is a **Tinder-style card** showing a **full-bleed Yelp photo** (`recommendation.photoUrl`, the server's `image_url`) — or, when there's no photo, a **non-interactive map of the place** as the filler (`CardLocationMap`) — with the headline + quick facts (category/price/rating) over a gradient scrim. **Swipe left to skip** (soft skip — session-only, keeps the server from re-serving it this visit), **swipe right to accept**; the same actions stay as buttons (skip · "I'm in"). Any still-active persisted rejections (`shared/utils/rejections.ts`) plus session soft-skips ride every `/v1/recommendations` call as `excludedPlaceIds`. Skipping `consume`s the buffer head and promotes the already-hydrated next card instantly (a "finding next" flash only appears if fast swiping out-runs the refill).
   - **Picked — photo hero + content sheet.** Accepting reveals a single-scroll layout (`result-layout--sheet`): a **full-bleed photo hero** holding the **swipeable media carousel** (`ResultMedia`) — slide between the route map and **up to 3 Yelp photos** (`recommendation.photos`, dots indicate position; a photo that fails to load drops its own slide). The map carries the **You / place / drive-time context chips**; the **status chips (Pick №/Top Pick + Open/Closed) and the restaurant name live in the content card below** (not overlaid on the photo, so the name is never clipped). The card leads with the Pick/Open status chips + Share, then the `GO EAT <name>.` headline, the category/price/rating/distance/drive tags, the details (address/phone/website/hours), the **"Take me there"** maps-app picker, and **"← Pick again"**. When at least one photo is present the map is locked (non-interactive) so the horizontal drag switches slides instead of panning; with no photo it's the lone interactive map (compass hidden via `showsCompass={0}`). `mapkit.Directions` draws the route from the user to the pick (computed only now — not per swiped card) and auto-fits both points. On desktop (≥769px) it becomes a **two-pane split** — a floating, rounded, shadowed **map card** on the left (with the You/place/drive chips), and a scrolling details pane on the right whose details render as a **white two-column card** (the page itself doesn't scroll). Mobile keeps the stacked photo-hero + light sheet (hairline detail rows, no subtext line). The sheet matches the app's light theme (cream, ink headline with an accent place-name span, ink **"Take me there"** button); only a **Top Pick** flips it to the dark/gold takeover (`.result-layout--toppick`).
   - **Changing location.** The header's top-right **city indicator** (reverse-geocoded from the current coordinates via `mapkit.Geocoder.reverseLookup`, shows "Locating…" until resolved) doubles as the location changer: tapping it opens the full-screen `AddressSearch` (the `NotFoundScreen` in its neutral `variant="change"` copy, with a **"← Back to picks"** escape when a pick already exists) so the user can type a new place or hit "Use my location". This replaces the old "Wrong location?" link.
6. When the server flags `source: "top_pick"`, both phases get the **Top Pick** dark takeover: a `swipe-deck--toppick` / `result-layout--toppick` modifier flips to dark mode, swaps marker/route to gold, shows a gold "★ Top Pick" badge, paints the place name gold, swaps the subtext to "You unlocked a top pick. Don't waste this." and adds a "Why this is a top pick" callout that surfaces `recommendation.blurb`.
7. The share screen `POST`s the place to `${NEXT_PUBLIC_API_BASE_URL}/v1/places` and renders a short link at `/p/{shortId}`, which hydrates from `GET /v1/places/{shortId}`.

The whole UI is driven by a `STATUS` state machine (`types/index.ts`) plus a separate `screen` enum (`loading | notfound | noresults | result | share`). `LOCATION_NOT_FOUND` → `notfound`, `NO_RESULTS_FOUND` → `noresults` — two intentionally distinct screens.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Pages Router, static export) |
| Language | TypeScript, React 19 |
| Data Fetching | [`@tanstack/react-query`](https://tanstack.com/query) (all API calls — see `shared/api.ts` and `shared/queries.ts`) |
| Maps | Apple MapKit JS via [`mapkit-react`](https://github.com/Nicolapps/mapkit-react) |
| Animation | [`motion`](https://motion.dev/) (Framer Motion) — result-card swipe gestures |
| Error Tracking | Bugsnag (production only, via `ErrorBoundary`) |
| Analytics | Umami + Google Analytics (production only) |
| Styling | Vanilla CSS + design tokens (`styles/tokens.css`), Google Fonts (Archivo, Inter, JetBrains Mono) |

## Design System

The visual language is tokenized in **`styles/tokens.css`** (a `:root` block + `.text-*`
utility classes), imported before `styles/globals.css` in `pages/_app.js`. Every rule in
`globals.css` consumes these tokens rather than hard-coded values — when adjusting type or
spacing, change the token, not the call sites.

**Typography** is one continuous ramp, biggest → smallest. Each tier is a bundle of
size/line-height/weight/tracking (vars `--t-<tier>-size` etc.), also available as a
`.text-<tier>` utility class:

| Tier | Size | Role |
|------|------|------|
| `d1` | `clamp(88,16vw,240)` | Hero poster headline (DownScreen) |
| `d2` | `clamp(64,9vw,120)` | Loading headline |
| `d3` | `clamp(44,8vw,80)` | Primary screen headlines (NotFound / result / share) |
| `d4` | `clamp(28,5vw,48)` | Secondary headlines (peek / rejection / tile name) |
| `h1xl` | 24 | Card headline, section title |
| `h1` | 20 | Header title |
| `h2` | 17 | Sub-headings, large buttons |
| `h3` | 15 | Mid buttons |
| `p1` | 14 | Default body |
| `p2` | 13 | Common body |
| `p3` | 12 | Small body |
| `caption` | 11 | Chips, labels |
| `overline` | 10 | Field labels, tile meta (uppercase) |
| `micro` | 9 | Mono kind tags (uppercase) |

`d1`–`h1` are uppercase Archivo display type; `h2`/`h3` are Archivo; `p1`–`caption` are
Inter; `micro` is JetBrains Mono. The fluid `clamp()` display tiers replace the old
per-breakpoint headline size overrides. The typefaces themselves are `--font-display`
(Archivo), `--font-body` (Inter), `--font-mono` (JetBrains Mono); the legacy
`--display`/`--body`/`--mono` aliases still resolve.

**Spacing** is a 4px base scale with half-steps for fidelity: `--space-1` (4px) through
`--space-12` (48px), plus half-steps like `--space-1_5` (6px) and `--space-3_5` (14px).
**Radius:** `--radius-xs/sm/chip/md/card/lg/xl/2xl` (4 → 24px) plus `--radius-pill` and
`--radius-circle`. **Weights:** `--weight-regular`…`--weight-black` (note Inter only ships
400–700, so body text stays ≤ 700). **Tracking:** `--tracking-tightest`…`--tracking-caps`.

Colors are still raw vars in `globals.css` `:root` (`--bg`, `--ink`, `--accent`, …) and are
not yet tokenized.

## Project Structure

```
pages/
  index.tsx          # TokenLoader: fetches/caches MapKit JWT, renders <Map />
  p/[id].tsx         # Shared place page — hydrates from /v1/places/:id
  _app.js            # Global SEO meta, GA + Umami script tags (prod only)
  _document.tsx      # HTML shell, font preconnect/link tags
components/
  Map.tsx            # State machine, geolocation, POI search, directions, screen routing
  Header.tsx         # App header
  LoadingScreen.tsx  # Loading state with rotating witty messages
  NotFoundScreen.tsx # "We lost you" (geolocation failed) AND the "change location" changer (variant prop): AddressSearch, retry/use-my-location, curated neighborhood grid (stubbed)
  NoResultsScreen.tsx# "All out" — location is fine but no spots left nearby: "Start over" (clears rejections) + AddressSearch
  AddressSearch.tsx  # Shared mapkit.Search autocomplete input with staged "Use this →" confirm; used by NotFound + NoResults
  DistrictGrid.tsx   # Renders a list of districts as <DistrictTile>s
  DistrictTile.tsx   # Single neighborhood tile (number / city / name / sub) — exports the `District` type
  DownScreen.tsx     # "BACK SOON." — rendered when /v1/health is down or /v1/token fails
  ResultScreen.tsx   # Two phases: swipe deck (cards, no map; photo or map-filler) → picked results + map ("Pick again" returns)
  ShareScreen.tsx    # POSTs place to API, builds short link + share tiles
  Overlay.tsx        # Status overlay
  ErrorBoundary.tsx  # Bugsnag in prod, console in dev
shared/
  api.ts             # Typed fetchers for all API endpoints (health, token, feature flags, places, recommendations)
  queries.ts         # React Query hooks: useHealthQuery, useTokenQuery, useFeatureFlag(s)Query, useSharedPlaceQuery, useCreateSharedPlaceMutation
  recommendationHydration.ts # toPlace() slim adapter + hydrateRecommendation() (MapKit PlaceLookup, 4s fallback)
  queryClient.ts     # makeQueryClient() — shared QueryClient defaults
  constants.ts       # Loading lines and rejection messages
  hooks/             # useIsDev (analytics/bugsnag gate); useRecommendationQueue (prefetch buffer of hydrated picks)
  utils/
    index.ts         # Barrel: re-exports track + session helpers
    track.ts         # Umami event helper (no-ops if script not loaded)
    session.ts       # Per-visit session counters surfaced via session_summary
    rejections.ts    # localStorage-backed rejection store (growing TTL: 1d → 30d) sent as excludedPlaceIds (legacy entries still honored; no longer written)
    softSkips.ts     # session-only soft-skip set (no TTL) also sent as excludedPlaceIds
types/
  index.ts           # STATUS enum (state machine)
  mapkit.d.ts        # MapKit type declarations
styles/
  tokens.css         # Design tokens: type ramp (d1→micro), spacing, radius, tracking, weights + .text-* utilities
  globals.css        # All component styles (consume tokens.css)
public/              # manifest.json, robots.txt, sitemap.xml, favicons
server.js            # Optional local HTTPS dev server (geolocation needs HTTPS)
next.config.js       # output: 'export' — fully static build
```

Two files exist but are currently unused: `services/api.ts` (empty) and `shared/hooks/use-addsense.ts` (defined but never imported).

## Backend Contract

The frontend is fully static; all stateful behavior lives behind `NEXT_PUBLIC_API_BASE_URL`. The expected endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/ready` | Boot-time readiness check (verifies the API can reach its DB). `2xx` means ready; anything else renders the `DownScreen`. |
| `GET` | `/v1/token` | Returns `{ token, expiresAt, ttl }` as JSON. The client caches `token` in `localStorage` and refreshes ~30 s before `expiresAt`. A failed response renders the `DownScreen`. |
| `POST` | `/v1/recommendations` | Body: `{ latitude, longitude, excludedPlaceIds }`. Returns `{ recommendation: { appleMapsPlaceId, name, address, latitude, longitude, blurb?, source }, searchRadiusMeters }` or `404` with `{ error: { code: "NOT_FOUND", … } }` when nothing in range. Drives the main "what should I eat" pick. |
| `POST` | `/v1/places` | Body: `{ appleMapsPlaceId, name, address, latitude, longitude }`. Returns `{ shortId, created }` for use in `/p/:shortId`. |
| `GET` | `/v1/places/:shortId` | Returns the stored place; 404 renders the "link expired" screen. |
| `GET` | `/v1/feature-flags` | Returns `{ [flagName]: string }` (values are arbitrary strings — use `"true"`/`"false"` for boolean-style flags). Fetched via React Query (`useFeatureFlagsQuery`) and exposed via `useFeatureFlag(name)` (true only when the value is exactly `"true"`) or `useFeatureFlagValue(name)` for variant flags. Unknown flags are `undefined`. |

## Prerequisites

- Node.js (v18+)
- A backend API that implements the [endpoints above](#backend-contract) — at minimum `GET /v1/token` for MapKit auth, plus `/v1/places` if you want share links to work

### MapKit JS Token

The app does **not** sign its own JWT. It expects an external API to provide the token. To obtain the credentials needed by that API, visit [Apple's MapKit JS documentation](https://developer.apple.com/documentation/mapkitjs/creating_a_maps_identifier_and_a_private_key):

- Apple Developer Team ID
- MapKit JS Key ID
- MapKit JS Private Key (`.p8` file)

## Setup

1. Clone the repo:

   ```bash
   git clone https://github.com/juancstlm/WSIGTE.git
   cd WSIGTE
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file with your API base URL:

   ```
   NEXT_PUBLIC_API_BASE_URL=https://your-token-api.example.com
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Then open [http://localhost:3000](http://localhost:3000).

### Local HTTPS (optional)

Geolocation requires a secure context. If `npm run dev` doesn't work for location access, you can use the included HTTPS server:

1. Generate a self-signed certificate:

   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes
   ```

2. Run the HTTPS server:

   ```bash
   node server.js
   ```

   Then open [https://localhost:3000](https://localhost:3000).

## Build & Deploy

The app is configured for static export (`output: 'export'` in `next.config.js`):

```bash
npm run build
```

This generates a fully static site in the `out/` directory, ready to be deployed to any static hosting provider (Vercel, Netlify, GitHub Pages, S3, etc.).

## Analytics

Privacy-friendly analytics via [Umami](https://umami.is/), self-hosted at `analytics.juancastillom.com`. The tracker script is loaded in `pages/_app.js` via `next/script` and is gated behind `useIsDev`, so it only runs in production builds. The Umami website ID comes from the `NEXT_PUBLIC_UMAMI_WEBSITE_ID` env var, set per Amplify branch — production and staging report to **separate Umami sites** so production stats stay clean.

Custom events are emitted through the helper at `shared/utils/track.ts`, which safely no-ops if Umami hasn't loaded.

| Event | Where | Data |
|-------|-------|------|
| `session_start` | once per visit, on `_app` mount | `{ entry, utm_source?, utm_medium?, utm_campaign?, utm_term?, utm_content? }` |
| `session_summary` | best-effort on `pagehide`/visibility hidden | `{ searches, picksShown, picksRejected, tookDirections, sharedPlaceViewed }` |
| `geolocation_granted` | browser geolocation success | — |
| `geolocation_denied` | user denied permission | `{ code }` |
| `geolocation_error` | other geolocation failure | `{ code, message }` |
| `geolocation_timeout` | 10s elapsed without resolution | — |
| `shared_place_viewed` | `/p/[id]` resolved successfully | `{ id }` |
| `shared_place_not_found` | `/p/[id]` 404 / fetch error | `{ id }` |
| `shared_place_cta_clicked` | CTA on `/p/[id]` clicked | `{ cta, id?, from? }` |
| `no_results_found` | buffer drained and the server has nothing left nearby | — |
| `noresults_reset` | "Start over" on the No Results screen (clears rejections/skips, re-rolls) | — |
| `pick_shown` | a random pick is rendered (fires for every pick, including re-rolls) | `{ pickNumber, source }` |
| `pick_swiped` | swipe card flung past threshold | `{ direction }` (`skip` or `accept`) |
| `pick_accepted` | a card accepted (swipe right / "I'm in") — reveals map + results | `{ pickNumber, source }` |
| `pick_again_clicked` | "← Pick again" from the results view (back to the deck) | — |
| `change_location_clicked` | header city indicator tapped to open the changer | — |
| `change_location_cancelled` | "← Back to picks" from the changer | — |
| `manual_location_lookup` | user submits an address | — |
| `manual_location_lookup_failed` | geocoder couldn't resolve it | — |
| `autocomplete_suggestion_selected` | user picks an autocomplete result in `AddressSearch` | `{ kind, context }` (`kind`: address / transit / area; `context`: notfound / noresults) |
| `district_tile_clicked` | curated neighborhood tile tapped | `{ name, city }` |
| `locate_me_clicked` | "Locate me" button on Not Found screen | — |
| `notfound_input_cleared` | × button cleared the address input | `{ context }` (notfound / noresults) |
| `notfound_selection_cleared` | "change" button cleared a staged selection | `{ context }` (notfound / noresults) |
| `vote_cta_clicked` | "Start vote" CTA on the share screen (gated by `voting` flag) | — |
| `feature_flags_loaded` | one-shot, once `/v1/feature-flags` resolves per session | the raw flags object (e.g. `{ voting: false, "curated-districts": true }`) |
| `take_me_there_clicked` | opens the map app picker | — |
| `map_service_selected` | Apple/Google/Waze chosen | `{ service }` |
| `share_link_copied` | copy button on share screen | — |
| `share_native` | native `navigator.share` invoked | — |
| `share_tile_clicked` | Messages/WhatsApp/Email/X tile | `{ tile }` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API that serves the MapKit JS JWT token and shared place endpoints |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Umami website ID for the current environment. Set per-branch in Amplify (production branch → prod site ID; staging branch → staging site ID) so each environment reports to its own Umami site. |

> Set these in the AWS Amplify console under **App settings → Environment variables**. Because they're prefixed `NEXT_PUBLIC_`, Next.js inlines them at build time. If `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is missing the Umami `<Script>` simply doesn't render.
