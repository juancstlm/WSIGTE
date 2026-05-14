import { useState } from "react";
import { DOWN_LINES } from "../shared/constants";

interface DownScreenProps {
  statusCode?: number | string;
  onRetry?: () => void;
}

export function DownScreen({ statusCode = 503, onRetry }: DownScreenProps) {
  const [line] = useState(() => DOWN_LINES[Math.floor(Math.random() * DOWN_LINES.length)]);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div className="down-shell">
      <header className="down-header">
        <div className="header-brand">
          <div className="header-logo">W</div>
          <div className="header-title">WSIGTE</div>
        </div>
        <span className="down-stamp">{statusCode}</span>
      </header>

      <main className="down-stage">
        <div className="down-core">
          <span className="down-badge">
            <span className="down-badge-dot" />
            Down for maintenance
          </span>

          <h1 className="down-headline">
            BACK<br />
            <span>SOON.</span>
          </h1>

          <p className="down-deadpan">{line}</p>

          <button type="button" className="down-btn" onClick={handleRetry}>
            Try again →
          </button>
        </div>
      </main>

      <footer className="down-footer">
        <span>WSIGTE.COM</span>
        <span>STATUS · DOWN</span>
      </footer>
    </div>
  );
}
