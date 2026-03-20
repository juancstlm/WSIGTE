# WSIGTE (Where Should I Go To Eat?)

A web app that picks a random restaurant, cafe, or bakery near you so you never have to argue about where to eat again. Built with [Next.js](https://nextjs.org/) and Apple's [MapKit JS](https://developer.apple.com/documentation/mapkitjs/) via [mapkit-react](https://github.com/Nicolapps/mapkit-react).

Live at **[wsigte.com](https://wsigte.com)**

## How It Works

1. The app requests your location (browser geolocation or manual address entry).
2. It searches nearby restaurants, cafes, and bakeries using MapKit's point-of-interest search.
3. A random result is selected and displayed on the map with driving directions.
4. Don't like the suggestion? Hit **"No! That Place Looks Awful"** to get another one.
5. Location wrong? Hit **"My Location is Wrong"** to enter an address manually.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (static export) |
| Language | TypeScript / React 18 |
| Maps | Apple MapKit JS via `mapkit-react` |
| Error Tracking | Bugsnag (production only) |
| Analytics | Google Analytics (production only) |
| Styling | Vanilla CSS with Google Fonts (Rajdhani) |

## Project Structure

```
pages/
  index.tsx          # Entry point — fetches MapKit JWT token, renders Map
  _app.js            # Global layout, SEO meta tags, analytics
  _document.tsx      # HTML document shell
components/
  Map.tsx            # Core map logic: location, search, directions, UI
  Overlay.tsx        # Loading/status overlay shown during init and errors
  ErrorBoundary.tsx  # React error boundary (Bugsnag in prod, console in dev)
shared/
  hooks/             # useIsDev hook
  utils/             # Random place generator, place deduplication
services/
  api.ts             # Legacy Yelp API helper (unused)
types/
  index.ts           # STATUS enum for app state machine
styles/
  globals.css        # All styles
public/
  manifest.json      # PWA manifest
  robots.txt         # Crawler rules
  sitemap.xml        # Sitemap for wsigte.com
server.js            # Optional local HTTPS dev server
```

## Prerequisites

- Node.js (v18+)
- A backend API that serves a MapKit JS JWT token at a `/token` endpoint (the app fetches from `NEXT_PUBLIC_API_BASE_URL/token` at runtime)

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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API that serves the MapKit JS JWT token |
