# WSIGTE (Where Should I Go To Eat?)

A web app that picks a random restaurant, cafe, or bakery near you so you never have to argue about where to eat again. Built with [Next.js](https://nextjs.org/) and Apple's [MapKit JS](https://developer.apple.com/documentation/mapkitjs/) via [mapkit-react](https://github.com/Nicolapps/mapkit-react).

Live at **[wsigte.com](https://wsigte.com)**

## How It Works

1. On load, `pages/index.tsx` fetches a short-lived MapKit JS JWT from `${NEXT_PUBLIC_API_BASE_URL}/v1/token` and caches it in `localStorage` until ~30s before expiry (decoded from the JWT payload).
2. `mapkit-react` boots a hidden map to acquire the user's coordinates via browser geolocation, falling back to a manual address input if it fails or times out (10s).
3. A `mapkit.Search` for `Bakery | Cafe | Restaurant` POIs runs against a 1°×1° region around the user.
4. Results are filtered against a `seenResults` set, shuffled by `createUniqueRandomGenerator`, and yielded one at a time so each "That's awful" rejection produces a fresh pick without duplicates.
5. `mapkit.Directions` draws a route polyline from the user to the selected pick; the map auto-fits both points.
6. The share screen `POST`s the place to `${NEXT_PUBLIC_API_BASE_URL}/v1/places` and renders a short link at `/p/{shortId}`, which hydrates from `GET /v1/places/{shortId}`.

The whole UI is driven by a `STATUS` state machine (`types/index.ts`) plus a separate `screen` enum (`loading | notfound | result | share`).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Pages Router, static export) |
| Language | TypeScript, React 19 |
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
  NotFoundScreen.tsx # Manual address fallback when location/search fails
  ResultScreen.tsx   # Pick details, route, "Take me there" map-app picker
  ShareScreen.tsx    # POSTs place to API, builds short link + share tiles
  Overlay.tsx        # Status overlay
  ErrorBoundary.tsx  # Bugsnag in prod, console in dev
shared/
  constants.ts       # Loading lines and rejection messages
  hooks/             # useIsDev (gates analytics + bugsnag in dev)
  utils/
    index.ts         # Place dedup key + unique-shuffle generator
    track.ts         # Umami event helper (no-ops if script not loaded)
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
| `GET` | `/v1/token` | Returns a MapKit JS JWT as `text/plain`. Must include a standard `exp` claim — the client decodes the payload to know when to refetch. |
| `POST` | `/v1/places` | Body: `{ appleMapsPlaceId, name, address, latitude, longitude }`. Returns `{ shortId }` for use in `/p/:shortId`. |
| `GET` | `/v1/places/:shortId` | Returns the stored place; 404 renders the "link expired" screen. |

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

Privacy-friendly analytics via [Umami](https://umami.is/), self-hosted at `analytics.juancastillom.com`. The tracker script is loaded in `pages/_app.js` via `next/script` and is gated behind `useIsDev`, so it only runs in production.

Custom events are emitted through the helper at `shared/utils/track.ts`, which safely no-ops if Umami hasn't loaded.

| Event | Where | Data |
|-------|-------|------|
| `results_found` | nearby search succeeded | `{ count }` |
| `no_results_found` | search returned nothing (or all seen) | `{ reason? }` |
| `pick_shown` | a random pick is rendered | — |
| `pick_rejected` | "That's awful" clicked | `{ pickNumber }` |
| `wrong_location_clicked` | "Wrong location" clicked | — |
| `manual_location_lookup` | user submits an address | — |
| `manual_location_lookup_failed` | geocoder couldn't resolve it | — |
| `take_me_there_clicked` | opens the map app picker | — |
| `map_service_selected` | Apple/Google/Waze chosen | `{ service }` |
| `share_link_copied` | copy button on share screen | — |
| `share_native` | native `navigator.share` invoked | — |
| `share_tile_clicked` | Messages/WhatsApp/Email/X tile | `{ tile }` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API that serves the MapKit JS JWT token and shared place endpoints |
