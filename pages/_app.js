import Script from "next/script";
import Head from "next/head";

import { useIsDev } from "../shared/hooks";

import "../styles/globals.css";

function MyApp({ Component, pageProps }) {
  const devMode = useIsDev();
  return (
    <>
      <Head>
        <meta name="applicationName" content="WSIGTE" />
        <meta name="title" content="WSIGTE | Where Should I Go To Eat" />
        <meta name="description" content="Discover random places to eat near you. Find your next favorite restaurant effortlessly!" />
        <meta name="keywords" content="restaurants, food recommendations, places to eat, nearby dining, best restaurants, food guide, local eateries, dining options, restaurant reviews, foodie, dine out, eat out, restaurant finder, culinary destinations, dining recommendations" />
        <meta name="author" content="Juan Castillo" />
        <meta name="creator" content="Juan Castillo" />
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
