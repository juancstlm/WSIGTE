import { useMemo } from "react";

import { AddressSearch } from "./AddressSearch";

interface NoResultsScreenProps {
  // Look somewhere else — runs a geocoder lookup on the typed/picked query.
  onSearch: (query: string) => void;
  // Wipe the rejection/skip history and re-roll from the current location.
  onReset: () => void;
  userCoordinates?: { latitude: number; longitude: number };
}

// Distinct from NotFoundScreen on purpose: here the GPS worked fine, the user
// has simply exhausted every nearby spot (often after rejecting a bunch), so
// the copy owns that instead of crying "we lost you".
const HEADLINES: { main: string; br: string; tail: string }[] = [
  { main: "That's", br: "everyone", tail: ", sorry." },
  { main: "You", br: "ate", tail: " the map." },
  { main: "Fresh", br: "out", tail: " of spots." },
  { main: "Kitchen's", br: "closed", tail: "… nearby." },
  { main: "Nothing", br: "left", tail: ", chief." },
  { main: "Out", br: "of", tail: " options." },
];

function RefreshIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function NoResultsScreen({ onSearch, onReset, userCoordinates }: NoResultsScreenProps) {
  const headline = useMemo(
    () => HEADLINES[Math.floor(Math.random() * HEADLINES.length)],
    []
  );

  return (
    <div className="screen-notfound">
      <div className="notfound-inner notfound-inner--centered">
        <div className="notfound-hero">
          <div className="notfound-hero-text">
            <span className="chip chip--filled chip--accent chip--white">! all out</span>
            <div className="notfound-headline">
              {headline.main}<br />{headline.br}<span>{headline.tail}</span>
            </div>
          </div>
          <div className="notfound-subtext">
            We ran through every spot near you. Wipe the slate and re-roll, or
            point us at a different patch of the map.
          </div>
        </div>

        <div className="noresults-reset-row">
          <button type="button" className="btn-locate" onClick={onReset}>
            <RefreshIcon size={16} color="#fff" />
            Start over
          </button>
          <span className="noresults-reset-note">
            clears the spots you passed on
          </span>
        </div>

        <div className="district-section-header">
          <div className="district-section-title">
            Or look <span>somewhere else</span>
          </div>
        </div>

        <AddressSearch
          onSubmit={onSearch}
          userCoordinates={userCoordinates}
          trackContext="noresults"
          placeholder="Try another neighborhood or address"
        />
      </div>
    </div>
  );
}
