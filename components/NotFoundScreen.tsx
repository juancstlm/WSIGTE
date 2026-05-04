import { useState } from "react";

interface NotFoundScreenProps {
  onRetry: (query: string) => void;
}

export function NotFoundScreen({ onRetry }: NotFoundScreenProps) {
  const [query, setQuery] = useState("");

  return (
    <div className="screen-notfound">
      <span className="chip chip--filled chip--accent" style={{ color: "var(--accent)" }}>
        ! WE LOST YOU
      </span>
      <div className="notfound-headline">
        WHERE<br />ARE YOU,<br /><span>actually?</span>
      </div>
      <div className="notfound-subtext">
        Drop in an address, neighborhood, or a vague gesture in the right direction.
      </div>
      <div className="notfound-form">
        <input
          className="input-field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="2400 Mandela Pkwy, Oakland"
          onKeyDown={(e) => {
            if (e.key === "Enter" && query) onRetry(query);
          }}
        />
        <div style={{ height: 10 }} />
        <button
          className="btn-primary"
          onClick={() => query && onRetry(query)}
          disabled={!query}
        >
          Try again →
        </button>
      </div>
    </div>
  );
}
