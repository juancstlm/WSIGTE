import * as React from "react";
import Head from "next/head";

import { DownScreen } from "../components/DownScreen";
import { ErrorBoundary } from "../components/ErrorBoundary";
import Map from "../components/Map";
import { ApiError } from "../shared/api";
import { useHealthQuery, useTokenQuery } from "../shared/queries";

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
  const health = useHealthQuery();
  const healthy = health.data?.ok === true;
  const token = useTokenQuery(healthy);

  const handleRetry = () => {
    health.refetch();
    token.refetch();
  };

  if (health.data && !health.data.ok) {
    return <DownScreen statusCode={health.data.status} onRetry={handleRetry} />;
  }

  if (token.error) {
    const status =
      token.error instanceof ApiError ? token.error.status : "ERR";
    if (token.error instanceof ApiError) {
      console.error("Failed to fetch MapKit token:", token.error);
    }
    return <DownScreen statusCode={status} onRetry={handleRetry} />;
  }

  if (!token.data) {
    return (
      <div className="token-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return <Map token={token.data} />;
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
