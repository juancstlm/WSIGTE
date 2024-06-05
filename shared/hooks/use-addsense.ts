import { useEffect } from "react";
import AdSense from 'react-adsense';

const useAddSense = () => {
    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
        script.async = true;
        document.body.appendChild(script);
      }, [] );
}

export default useAddSense;