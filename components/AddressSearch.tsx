import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { track } from "../shared/utils";

interface AutocompleteItem {
  displayLines: string[];
  raw: any;
}

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 200;

export interface StagedSelection {
  main: string;
  sub?: string;
  query: string;
}

export interface AddressSearchHandle {
  // Lets a parent (e.g. a district tile) stage a selection into the search,
  // surfacing the same "Use this →" confirm step a typed/picked address gets.
  stage: (next: StagedSelection) => void;
}

interface AddressSearchProps {
  onSubmit: (query: string) => void;
  userCoordinates?: { latitude: number; longitude: number };
  placeholder?: string;
  submitLabel?: string;
  // Rendered in the right column when nothing is staged (e.g. a "Locate me"
  // button). When a selection is staged it's replaced by the confirm button.
  idleAction?: React.ReactNode;
  // Tag analytics with which screen the search lives on.
  trackContext?: string;
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

export const AddressSearch = forwardRef<AddressSearchHandle, AddressSearchProps>(
  function AddressSearch(
    {
      onSubmit,
      userCoordinates,
      placeholder = "Address, neighborhood, or vague gesture",
      submitLabel = "Use this →",
      idleAction,
      trackContext = "notfound",
    },
    ref
  ) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [selected, setSelected] = useState<StagedSelection | null>(null);
    const justSelected = useRef(false);
    const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
    const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

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

    const stage = (next: StagedSelection) => {
      justSelected.current = true;
      setQuery(next.main);
      setSuggestions([]);
      setOpen(false);
      setSelected(next);
    };

    useImperativeHandle(ref, () => ({ stage }), []);

    const selectSuggestion = (item: AutocompleteItem) => {
      track("autocomplete_suggestion_selected", {
        kind: inferKind(item),
        context: trackContext,
      });
      stage({
        main: item.displayLines[0],
        sub: item.displayLines.slice(1).join(", ") || undefined,
        query: item.displayLines.join(", "),
      });
    };

    const clearSelected = () => {
      track("notfound_selection_cleared", { context: trackContext });
      setSelected(null);
      setQuery("");
    };

    const confirmSelected = () => {
      if (!selected) return;
      onSubmit(selected.query);
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

    return (
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
                placeholder={placeholder}
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
                    track("notfound_input_cleared", { context: trackContext });
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
            {submitLabel}
          </button>
        ) : (
          idleAction
        )}
      </div>
    );
  }
);
