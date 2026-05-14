import { useEffect, useMemo, useRef, useState } from "react";

import { DistrictGrid } from "./DistrictGrid";
import type { District } from "./DistrictTile";
import { useFeatureFlag } from "../shared/queries";
import { track } from "../shared/utils";

interface AutocompleteItem {
  displayLines: string[];
  raw: any;
}

interface NotFoundScreenProps {
  onRetry: (query: string) => void;
  onRelocate?: () => void;
  userCoordinates?: { latitude: number; longitude: number };
}

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 200;

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

function PinIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function TransitIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 11h14M9 21l1.5-3M15 21l-1.5-3" />
      <circle cx="9" cy="14" r="1" fill={color} />
      <circle cx="15" cy="14" r="1" fill={color} />
    </svg>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return <>{text}</>;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="autocomplete-mark">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

function inferKind(item: AutocompleteItem): string {
  const sub = (item.displayLines[1] || "").toLowerCase();
  if (/station|bart|transit|metro|airport/.test(sub)) return "transit";
  if (/neighborhood|district/.test(sub)) return "area";
  return "address";
}

export function NotFoundScreen({ onRetry, onRelocate, userCoordinates }: NotFoundScreenProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<{ main: string; sub?: string; query: string } | null>(null);
  const justSelected = useRef(false);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const headline = useMemo(
    () => HEADLINES[Math.floor(Math.random() * HEADLINES.length)],
    []
  );
  const curatedDistrictsEnabled = useFeatureFlag("curated-districts");

  useEffect(() => {
    if (selected) confirmBtnRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (activeIndex < 0) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const search = useMemo(() => {
    if (typeof window === "undefined" || !window.mapkit?.Search) return null;
    const opts: any = { getsUserLocation: true, language: "en-US" };
    if (userCoordinates) {
      const coord = new mapkit.Coordinate(
        userCoordinates.latitude,
        userCoordinates.longitude
      );
      opts.region = new mapkit.CoordinateRegion(
        coord,
        new mapkit.CoordinateSpan(1, 1)
      );
    }
    return new mapkit.Search(opts);
  }, [userCoordinates]);

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (!search || query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const handle = setTimeout(() => {
      (search as any).autocomplete(query, (error: any, data: any) => {
        if (error || !data?.results) {
          setSuggestions([]);
          return;
        }
        const items: AutocompleteItem[] = data.results
          .filter((r: any) => Array.isArray(r.displayLines) && r.displayLines.length)
          .slice(0, 6)
          .map((r: any) => ({ displayLines: r.displayLines, raw: r }));
        setSuggestions(items);
        setOpen(items.length > 0);
        setActiveIndex(-1);
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, search]);

  const stage = (next: { main: string; sub?: string; query: string }) => {
    justSelected.current = true;
    setQuery(next.main);
    setSuggestions([]);
    setOpen(false);
    setSelected(next);
  };

  const selectSuggestion = (item: AutocompleteItem) => {
    track("autocomplete_suggestion_selected", { kind: inferKind(item) });
    stage({
      main: item.displayLines[0],
      sub: item.displayLines.slice(1).join(", ") || undefined,
      query: item.displayLines.join(", "),
    });
  };

  const pickDistrict = (d: District) => {
    track("district_tile_clicked", { name: d.name, city: d.city });
    stage({
      main: d.name,
      sub: `${d.city} · ${d.sub}`,
      query: `${d.name}, ${d.city}`,
    });
  };

  const clearSelected = () => {
    track("notfound_selection_cleared");
    setSelected(null);
    setQuery("");
  };

  const confirmSelected = () => {
    if (!selected) return;
    onRetry(selected.query);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[activeIndex]);
          return;
        }
      }
    }
    if (e.key === "Enter" && query) {
      stage({ main: query, query });
    }
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

        <div className="notfound-search-row">
          {selected ? (
            <div className="notfound-confirm">
              <PinIcon size={18} color="var(--accent)" />
              <div className="notfound-confirm-text">
                <div className="notfound-confirm-main">{selected.main}</div>
                {selected.sub && (
                  <div className="notfound-confirm-sub">{selected.sub}</div>
                )}
              </div>
              <button
                type="button"
                className="notfound-confirm-change"
                onClick={clearSelected}
              >
                change
              </button>
            </div>
          ) : (
            <div className="autocomplete-wrapper">
              <div className="notfound-input-shell">
                <PinIcon size={18} color="var(--ink)" />
                <input
                  className="notfound-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Address, neighborhood, or vague gesture"
                  onKeyDown={onKeyDown}
                  onFocus={() => suggestions.length && setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {query && (
                  <button
                    type="button"
                    className="notfound-input-clear"
                    aria-label="clear"
                    onClick={() => {
                      track("notfound_input_cleared");
                      setQuery("");
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              {open && suggestions.length > 0 && (
                <div className="autocomplete-list">
                  <ul className="autocomplete-scroll" role="listbox">
                    {suggestions.map((item, i) => {
                      const kind = inferKind(item);
                      return (
                        <li
                          key={i}
                          ref={(el) => { itemRefs.current[i] = el; }}
                          role="option"
                          aria-selected={i === activeIndex}
                          className={
                            "autocomplete-item" +
                            (i === activeIndex ? " autocomplete-item--active" : "")
                          }
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(item);
                          }}
                        >
                          <div className="autocomplete-icon">
                            {kind === "transit" ? (
                              <TransitIcon size={16} color="var(--ink)" />
                            ) : (
                              <PinIcon size={16} color="var(--ink)" />
                            )}
                          </div>
                          <div className="autocomplete-text">
                            <div className="autocomplete-primary">
                              <Highlight text={item.displayLines[0]} q={query} />
                            </div>
                            {item.displayLines[1] && (
                              <div className="autocomplete-secondary">
                                {item.displayLines.slice(1).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="autocomplete-kind">{kind}</div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="autocomplete-hint" aria-hidden>
                    ↑↓ to browse · ↵ to pick
                  </div>
                </div>
              )}
            </div>
          )}
          {selected ? (
            <button
              ref={confirmBtnRef}
              type="button"
              className="btn-locate btn-locate--use"
              onClick={confirmSelected}
            >
              Use this →
            </button>
          ) : (
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
          )}
        </div>

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
