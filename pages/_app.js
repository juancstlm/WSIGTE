import Script from "next/script";
import Head from "next/head";

import { useIsDev } from "../shared/hooks";

import "../styles/globals.css";

const SITE_URL = "https://wsigte.com";
const SITE_TITLE = "Where Should I Go To Eat? | Random Restaurant Finder";
const SITE_DESCRIPTION =
  "Can't decide where to eat? Get a random restaurant recommendation near you instantly. Discover local restaurants, cafes, and bakeries with directions — no more decision fatigue.";

function MyApp({ Component, pageProps }) {
  const devMode = useIsDev();
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{SITE_TITLE}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta name="keywords" content="where to eat, random restaurant picker, restaurant finder near me, food recommendations, places to eat nearby, lunch ideas, dinner ideas, local restaurants, cafe finder, what to eat, decide where to eat, nearby dining, food roulette" />
        <meta name="author" content="Juan Castillo" />
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content={SITE_TITLE} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:site_name" content="WSIGTE" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SITE_TITLE} />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />

        {/* Theme & Mobile */}
        <meta name="theme-color" content="#ff6e30" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WSIGTE" />
        <meta name="application-name" content="WSIGTE" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      {!devMode && (
        <>
          <Script
            strategy="afterInteractive"
            src="https://www.googletagmanager.com/gtag/js?id=G-SEH4RQ8VWF"
          ></Script>
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SEH4RQ8VWF', {
              page_path: window.location.pathname,
            });
          `,
            }}
          ></Script>
        </>
      )}
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
