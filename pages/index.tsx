import * as React from "react";
import Head from "next/head";

import { ErrorBoundary } from "../components/ErrorBoundary";
import Map from "../components/Map";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const TOKEN_URL = `${API_BASE_URL}/v1/token`;
const TOKEN_CACHE_KEY = "wsigte_mapkit_token";
const TOKEN_EXPIRY_BUFFER_S = 30;

function getCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!cached) return null;
    const payload = JSON.parse(atob(cached.split(".")[1]));
    if (payload.exp - TOKEN_EXPIRY_BUFFER_S > Date.now() / 1000) return cached;
  } catch {}
  localStorage.removeItem(TOKEN_CACHE_KEY);
  return null;
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Where Should I Go To Eat?",
  alternateName: "WSIGTE",
  url: "https://wsigte.com",
  description:
    "Can't decide where to eat? Get a random restaurant recommendation near you instantly.",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "All",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Person",
    name: "Juan Castillo",
  },
};

function TokenLoader() {
  const [token, setToken] = React.useState<string | null>(getCachedToken);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (token) return;
    fetch(TOKEN_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
        return res.text();
      })
      .then((jwt) => {
        const trimmed = jwt.trim();
        localStorage.setItem(TOKEN_CACHE_KEY, trimmed);
        setToken(trimmed);
      })
      .catch((err) => {
        console.error("Failed to fetch MapKit token:", err);
        setError("Unable to load the map. Please try again later.");
      });
  }, [token]);

  if (error) {
    return (
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>{error}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Loading map...</p>
      </div>
    );
  }

  return <Map token={token} />;
}

export default function Home() {
  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>
      <main>
        <ErrorBoundary>
          <TokenLoader />
        </ErrorBoundary>
      </main>
    </>
  );
}
