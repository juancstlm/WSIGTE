import { useState, useEffect } from "react";
import { LOADING_LINES } from "../shared/constants";

export function LoadingScreen() {
  const [n, setN] = useState(0);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setN((v) => v + 1), 180);
    const t2 = setInterval(
      () => setLine((l) => (l + 1) % LOADING_LINES.length),
      1700
    );
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  return (
    <div className="screen-loading">
      <span className="chip chip--filled chip--accent" style={{ alignSelf: "center", color: "var(--accent)" }}>
        ● LOCATING YOU
      </span>
      <div className="loading-headline">
        HOLD<br />
        <span>STILL.</span>
      </div>
      <div className="loading-subtext">
        {LOADING_LINES[line]}{".".repeat(n % 4)}
      </div>
      <div className="loading-dots">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`loading-dot${(n + i) % 4 === 0 ? " loading-dot--active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
