# WSIGTE (Where Should I Go To Eat?)

A web app that picks a random restaurant, cafe, or bakery near you so you never have to argue about where to eat again. Built with [Next.js](https://nextjs.org/) and Apple's [MapKit JS](https://developer.apple.com/documentation/mapkitjs/) via [mapkit-react](https://github.com/Nicolapps/mapkit-react).

Live at **[wsigte.com](https://wsigte.com)**

## How It Works

1. On load, `pages/index.tsx` pings `${NEXT_PUBLIC_API_BASE_URL}/v1/health` first. If it returns non-2xx or a `down` status, the `DownScreen` ("BACK SOON.") renders with a **Try again** button that retries the boot sequence. Otherwise it fetches a short-lived MapKit JS JWT from `${NEXT_PUBLIC_API_BASE_URL}/v1/token` and caches it in `localStorage` until ~30s before expiry (decoded from the JWT payload). A failed token request also drops the user onto the `DownScreen` with the HTTP status code stamped in the header.
2. `mapkit-react` boots a hidden map to acquire the user's coordinates via browser geolocation. If it fails or times out (10s), the Not Found screen takes over: it offers a manual address input (the shared `AddressSearch` component, powered by `mapkit.Search.autocomplete`, debounced 200ms, min 3 chars, biased to the last known region), a "Locate me" button that retries browser geolocation, and a grid of curated neighborhood tiles that submit a geocoder lookup on tap. The neighborhood list is currently a static stub (`DISTRICTS` in `components/NotFoundScreen.tsx`) — a real API will replace it later.
3. The client `POST`s to `${NEXT_PUBLIC_API_BASE_URL}/v1/recommendations` with `{ latitude, longitude, excludedPlaceIds }`. The server returns one recommendation drawn either from a curated `top_picks` table (probabilistic — configured server-side) or from Apple's Maps Server API for nearby `Bakery | Cafe | Restaurant` POIs. The recommendation carries `name`, `address`, `latitude`, `longitude`, `appleMapsPlaceId`, and optional `blurb`. A `404` (nothing left in range — often because the user has rejected everything nearby) routes to the **No Results** screen, *not* the Not Found / "we lost you" screen: the GPS worked, so the copy owns running dry and offers a "Start over" button (clears the rejection/skip history via `clearRejections`/`clearSoftSkips` and re-rolls from the same coordinates) plus the same `AddressSearch` to look somewhere else.
4. The recommendation is hydrated client-side via `new mapkit.PlaceLookup().getPlace(appleMapsPlaceId, cb)` to populate `telephone` and `urls` (the Apple Maps Server API doesn't expose those — only the browser-side MapKit JS does). The loading screen stays up until hydration completes or a 4 s timeout falls back to the slim payload, so the result card always renders with contact info populated when available.
5. Rejections persist in `localStorage` (`shared/utils/rejections.ts`) with a growing TTL — 1 d, 3 d, 7 d, 14 d, 30 d as a place is rejected more times. The active list is sent on every `/v1/recommendations` call as `excludedPlaceIds`. "That's awful" records a rejection, bumps a query-key version to force a refetch, and holds the rejection overlay for at least 1.7 s.
6. `mapkit.Directions` draws a route polyline from the user to the selected pick; the map auto-fits both points.
7. When the server flags `source: "top_pick"`, the result screen renders the **03b · Top Pick** dark takeover: a `result-layout--toppick` modifier flips the screen to dark mode, swaps marker/route to gold, shows a gold "★ Top Pick" badge above the headline, paints the place name gold, swaps the subtext to "You unlocked a top pick. Don't waste this." and adds a "Why this is a top pick" callout that surfaces `recommendation.blurb`.
8. The share screen `POST`s the place to `${NEXT_PUBLIC_API_BASE_URL}/v1/places` and renders a short link at `/p/{shortId}`, which hydrates from `GET /v1/places/{shortId}`.

The whole UI is driven by a `STATUS` state machine (`types/index.ts`) plus a separate `screen` enum (`loading | notfound | noresults | result | share`). `LOCATION_NOT_FOUND` → `notfound`, `NO_RESULTS_FOUND` → `noresults` — two intentionally distinct screens.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Pages Router, static export) |
| Language | TypeScript, React 19 |
| Data Fetching | [`@tanstack/react-query`](https://tanstack.com/query) (all API calls — see `shared/api.ts` and `shared/queries.ts`) |
| Maps | Apple MapKit JS via [`mapkit-react`](https://github.com/Nicolapps/mapkit-react) |
| Error Tracking | Bugsnag (production only, via `ErrorBoundary`) |
| Analytics | Umami + Google Analytics (production only) |
| Styling | Vanilla CSS, Google Fonts (Archivo, Inter, JetBrains Mono) |

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
  NotFoundScreen.tsx # "We lost you" — geolocation failed: AddressSearch, retry geolocation, curated neighborhood grid (stubbed)
  NoResultsScreen.tsx# "All out" — location is fine but no spots left nearby: "Start over" (clears rejections) + AddressSearch
  AddressSearch.tsx  # Shared mapkit.Search autocomplete input with staged "Use this →" confirm; used by NotFound + NoResults
  DistrictGrid.tsx   # Renders a list of districts as <DistrictTile>s
  DistrictTile.tsx   # Single neighborhood tile (number / city / name / sub) — exports the `District` type
  DownScreen.tsx     # "BACK SOON." — rendered when /v1/health is down or /v1/token fails
  ResultScreen.tsx   # Pick details, route, "Take me there" map-app picker
  ShareScreen.tsx    # POSTs place to API, builds short link + share tiles
  Overlay.tsx        # Status overlay
  ErrorBoundary.tsx  # Bugsnag in prod, console in dev
shared/
  api.ts             # Typed fetchers for all API endpoints (health, token, feature flags, places, recommendations)
  queries.ts         # React Query hooks: useHealthQuery, useTokenQuery, useFeatureFlag(s)Query, useRecommendationQuery, useSharedPlaceQuery, useCreateSharedPlaceMutation
  queryClient.ts     # makeQueryClient() — shared QueryClient defaults
  constants.ts       # Loading lines and rejection messages
  hooks/             # useIsDev (gates analytics + bugsnag in dev)
  utils/
    index.ts         # Barrel: re-exports track + session helpers
    track.ts         # Umami event helper (no-ops if script not loaded)
    session.ts       # Per-visit session counters surfaced via session_summary
    rejections.ts    # localStorage-backed rejection store (growing TTL: 1d → 30d) sent as excludedPlaceIds
types/
  index.ts           # STATUS enum (state machine)
  mapkit.d.ts        # MapKit type declarations
styles/globals.css   # All styles
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
| `results_found` | `/v1/recommendations` returned a pick | `{ source }` (`top_pick` or `mapkit`) |
| `no_results_found` | recommendation call returned 404 or errored | — |
| `noresults_reset` | "Start over" on the No Results screen (clears rejections/skips, re-rolls) | — |
| `pick_shown` | a random pick is rendered (fires for every pick, including re-rolls) | `{ pickNumber }` |
| `pick_rejected` | "That's awful" clicked | `{ pickNumber }` |
| `wrong_location_clicked` | "Wrong location" clicked | — |
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
