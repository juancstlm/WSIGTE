import { useMemo, useRef, useState } from "react";

import { AddressSearch, type AddressSearchHandle } from "./AddressSearch";
import { DistrictGrid } from "./DistrictGrid";
import type { District } from "./DistrictTile";
import { useFeatureFlag } from "../shared/queries";
import { track } from "../shared/utils";

interface NotFoundScreenProps {
  onRetry: (query: string) => void;
  onRelocate?: () => void;
  userCoordinates?: { latitude: number; longitude: number };
}

const HEADLINES: { main: string; br: string; tail: string }[] = [
  { main: "Where", br: "to", tail: ", ish?" },
  { main: "Pin", br: "unknown", tail: ", sorry." },
  { main: "You", br: "vanished", tail: ", kind of." },
  { main: "Location", br: "pending", tail: "… maybe." },
  { main: "Somewhere", br: "out there", tail: ", allegedly." },
  { main: "GPS", br: "shrugged", tail: ", loudly." },
  { main: "Coordinates", br: "missing", tail: ", classic." },
];

// Stubbed curated foodie districts — will be replaced by an API later.
const DISTRICTS: District[] = [
  { name: "Temescal", sub: "pizza row", city: "Oakland" },
  { name: "Chinatown", sub: "dim sum sprawl", city: "Oakland" },
  { name: "The Mission", sub: "burrito triangle", city: "San Francisco" },
  { name: "North Beach", sub: "red-sauce mafia", city: "San Francisco" },
  { name: "West Oakland", sub: "smoke + soul", city: "Oakland" },
  { name: "Rockridge", sub: "yuppie deli belt", city: "Oakland" },
  { name: "K-Town", sub: "fried-chicken alley", city: "Oakland" },
  { name: "Outer Sunset", sub: "fog & ramen", city: "San Francisco" },
];

function CrosshairIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  );
}

export function NotFoundScreen({ onRetry, onRelocate, userCoordinates }: NotFoundScreenProps) {
  const [locating, setLocating] = useState(false);
  const searchRef = useRef<AddressSearchHandle | null>(null);
  const headline = useMemo(
    () => HEADLINES[Math.floor(Math.random() * HEADLINES.length)],
    []
  );
  const curatedDistrictsEnabled = useFeatureFlag("curated-districts");

  const pickDistrict = (d: District) => {
    track("district_tile_clicked", { name: d.name, city: d.city });
    searchRef.current?.stage({
      main: d.name,
      sub: `${d.city} · ${d.sub}`,
      query: `${d.name}, ${d.city}`,
    });
  };

  const handleLocate = () => {
    if (!onRelocate || locating) return;
    track("locate_me_clicked");
    setLocating(true);
    onRelocate();
  };

  return (
    <div className="screen-notfound">
      <div className={"notfound-inner" + (curatedDistrictsEnabled ? "" : " notfound-inner--centered")}>
        <div className="notfound-hero">
          <div className="notfound-hero-text">
            <span className="chip chip--filled chip--accent chip--white">! we lost you</span>
            <div className="notfound-headline">
              {headline.main}<br />{headline.br}<span>{headline.tail}</span>
            </div>
          </div>
          <div className="notfound-subtext">
            GPS whiffed. Yell a neighborhood, type an address, or ask the satellites to try again.
          </div>
        </div>

        <AddressSearch
          ref={searchRef}
          onSubmit={onRetry}
          userCoordinates={userCoordinates}
          idleAction={
            onRelocate && (
              <button
                type="button"
                className="btn-locate"
                onClick={handleLocate}
                disabled={locating}
              >
                <CrosshairIcon size={16} color="#fff" />
                {locating ? "Locating…" : "Locate me"}
              </button>
            )
          }
        />

        {curatedDistrictsEnabled && (
          <div className="district-section-header">
            <div className="district-section-title">
              Or yell a <span>neighborhood</span>
            </div>
            <div className="district-section-meta">curated</div>
          </div>
        )}

        {curatedDistrictsEnabled && (
          <DistrictGrid districts={DISTRICTS} onSelect={pickDistrict} />
        )}
      </div>
    </div>
  );
}
