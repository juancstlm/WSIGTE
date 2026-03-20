import * as React from "react";
import Head from "next/head";

import { ErrorBoundary } from "../components/ErrorBoundary";
import Map from "../components/Map";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const TOKEN_URL = `${API_BASE_URL}/token`;

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
  const [token, setToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(TOKEN_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
        return res.text();
      })
      .then((jwt) => setToken(jwt.trim()))
      .catch((err) => {
        console.error("Failed to fetch MapKit token:", err);
        setError("Unable to load the map. Please try again later.");
      });
  }, []);

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
