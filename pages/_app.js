import Script from "next/script";
import { useIsDev } from "../shared/hooks";

import "../styles/globals.css";

function MyApp({ Component, pageProps }) {
  const devMode = useIsDev();
  return (
    <>
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
