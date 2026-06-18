import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorScheme,
  Map as MapKitMap,
  Marker,
  Polyline,
} from "mapkit-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { bumpSession, track } from "../shared/utils";
import type {
  Coordinate,
  UserLocationChangeEvent,
  UserLocationErrorEvent,
} from "mapkit-react";
import type { HoursSlot, RecommendationResult } from "../shared/api";
import { SOFT_REJECT_LABELS } from "../shared/constants";
import { useFeatureFlag } from "../shared/queries";

export interface PlaceInfo {
  name: string;
  address: string;
  phone: string;
  website: string;
  urls: string[];
  categoryDisplayName: string | null;
  rating: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  hours: HoursSlot[] | null;
  yelpUrl: string | null;
  photoUrl: string | null;
  photos: string[];
}

export function getPlaceInfo(
  place: mapkit.Place,
  recommendation: RecommendationResult | null
): PlaceInfo {
  return {
    name: place.name,
    address: place.formattedAddress,
    phone: place.telephone || recommendation?.phone || "N/A",
    website: place.urls?.[0] || "",
    urls: place.urls || [],
    categoryDisplayName: recommendation?.categoryDisplayName ?? null,
    rating: recommendation?.rating ?? null,
    priceLevel: recommendation?.priceLevel ?? null,
    openNow: recommendation?.openNow ?? null,
    hours: recommendation?.hours ?? null,
    yelpUrl: recommendation?.yelpUrl ?? null,
    photoUrl: recommendation?.photoUrl ?? null,
    photos:
      recommendation?.photos && recommendation.photos.length > 0
        ? recommendation.photos
        : recommendation?.photoUrl
          ? [recommendation.photoUrl]
          : [],
  };
}

function formatDistanceMi(meters: number): string {
  const mi = meters / 1609.344;
  return mi < 0.1 ? `${(meters / 0.3048).toFixed(0)} FT` : `${mi.toFixed(1)} MI`;
}

// True once mounted on a desktop-width viewport. Starts false so static-export
// markup never assumes a desktop, and so mobile never instantiates desktop-only
// widgets (e.g. the blurred background MapKit map). Matches the CSS breakpoint.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

// Straight-line distance — used on the swipe cards so we don't fire a Directions
// call per browsed pick (the driving distance is computed once a card is picked).
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDriveMinutes(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} MIN DRIVE`;
}

// Pretty-print US/NANP numbers; leave anything else (international) untouched.
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

function formatHourMinute(hhmm: string): string {
  // "1430" → "2:30pm", "2200" → "10pm". Returns "" on malformed input.
  if (!/^\d{4}$/.test(hhmm)) return "";
  const hour = Number(hhmm.slice(0, 2));
  const min = hhmm.slice(2);
  const ampm = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return min === "00" ? `${hour12}${ampm}` : `${hour12}:${min}${ampm}`;
}

// Pick the slot that applies right now (or the next-upcoming one today). Yelp `day`: Mon=0..Sun=6.
function todaySlot(hours: HoursSlot[]): HoursSlot | null {
  const now = new Date();
  const yelpDow = (now.getDay() + 6) % 7;
  const nowHhmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const todays = hours.filter((s) => s.day === yelpDow);
  if (todays.length === 0) return null;
  return (
    todays.find((s) => s.start <= nowHhmm && (s.isOvernight || nowHhmm < s.end)) ??
    todays.find((s) => s.start > nowHhmm) ??
    todays[0]
  );
}

// Server's `openNow` is a hint from Yelp at fetch time. If we have the schedule, prefer the
// client-clock derivation — it stays correct as the day advances even on a stale cache.
function formatHoursBlurb(hours: HoursSlot[] | null, openNowHint: boolean | null): string | null {
  if (!hours || hours.length === 0) return openNowHint === false ? "Closed today" : null;
  const slot = todaySlot(hours);
  if (!slot) return "Closed today";
  const now = new Date();
  const yelpDow = (now.getDay() + 6) % 7;
  const nowHhmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const openNow =
    slot.day === yelpDow &&
    slot.start <= nowHhmm &&
    (slot.isOvernight || nowHhmm < slot.end);
  return openNow
    ? `Open · closes ${formatHourMinute(slot.end)}`
    : `Closed · opens ${formatHourMinute(slot.start)}`;
}

function deriveOpenNow(hours: HoursSlot[] | null, openNowHint: boolean | null): boolean | null {
  if (!hours || hours.length === 0) return openNowHint;
  const slot = todaySlot(hours);
  if (!slot) return false;
  const now = new Date();
  const yelpDow = (now.getDay() + 6) % 7;
  if (slot.day !== yelpDow) return false;
  const nowHhmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return slot.start <= nowHhmm && (slot.isOvernight || nowHhmm < slot.end);
}

const ACCENT = "#E04A2A";
const GOLD = "#C4960C";

export interface PeekInfo {
  name: string;
  photoUrl: string | null;
  isTopPick: boolean;
}

export interface ResultScreenProps {
  place: mapkit.Place;
  recommendation: RecommendationResult | null;
  peek: PeekInfo | null;
  picked: boolean;
  pickNumber: number;
  rejecting: boolean;
  rejectionLine: string;
  showMapPicker: boolean;
  mapServices: Array<{ name: string; url: string }>;
  onToggleMapPicker: () => void;
  onCloseMapPicker: () => void;
  onSkip: () => void;
  onPick: () => void;
  onBack: () => void;
  onShare: () => void;
  mapPickerRef: React.RefObject<HTMLDivElement | null>;
  mapRef: React.RefObject<mapkit.Map | null>;
  token: string;
  userCoordinates: Coordinate | undefined;
  routePoints: Coordinate[][];
  routeInfo: { distanceMeters: number; durationSeconds: number } | null;
  onMapLoad: () => void;
  onUserLocationChange: (event: UserLocationChangeEvent) => void;
  onUserLocationError: (event?: UserLocationErrorEvent) => void;
}

// Two phases: browse the swipe deck (cards only, no map), then — once the user
// accepts a pick — the map + full results take over. The phases crossfade (and
// the results rise in) so accepting a card flows straight into the map.
export function ResultScreen(props: ResultScreenProps) {
  return (
    <div className="result-phases">
      <AnimatePresence initial={false}>
        {props.picked ? (
          <motion.div
            key="detail"
            className="result-phase"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.98 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <ResultDetail {...props} />
          </motion.div>
        ) : (
          <motion.div
            key="deck"
            className="result-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <SwipeDeck {...props} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -- Browse phase: the swipe deck (no map) --

function SwipeDeck({
  place,
  recommendation,
  peek,
  pickNumber,
  rejecting,
  rejectionLine,
  token,
  userCoordinates,
  onSkip,
  onPick,
}: ResultScreenProps) {
  const info = getPlaceInfo(place, recommendation);
  const isTopPick = recommendation?.source === "top_pick";
  const bgCenter = userCoordinates ?? place.coordinate;
  // The blurred background map is desktop-only (its container is `display:none`
  // on mobile). MapKit JS can't initialize inside a `display:none` element and
  // throws on mobile Safari, blanking the deck — so only mount it on desktop.
  const isDesktop = useIsDesktop();

  return (
    <div
      className={`swipe-deck${isTopPick ? " swipe-deck--toppick" : ""}`}
    >
      {isDesktop && (
        <DeckBackgroundMap token={token} center={bgCenter} isTopPick={isTopPick} />
      )}

      <div className="swipe-stack">
        {peek && (
          <div
            className={`swipe-card swipe-peek-card${
              peek.isTopPick ? " swipe-peek-card--toppick" : ""
            }`}
            aria-hidden
          >
            <div
              className={`swipe-card-media${
                peek.photoUrl ? "" : " swipe-card-media--noimg"
              }`}
            >
              {peek.photoUrl && (
                <img className="swipe-card-photo" src={peek.photoUrl} alt="" />
              )}
              <div className="swipe-card-scrim" />
              <div className="result-headline result-headline--peek">
                <span>{peek.name}.</span>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          <SwipeCard
            key={place.id}
            place={place}
            info={info}
            isTopPick={isTopPick}
            pickNumber={pickNumber}
            token={token}
            userCoordinates={userCoordinates}
            onSkip={onSkip}
            onPick={onPick}
          />
        </AnimatePresence>

        {rejecting && (
          <div className="swipe-finding-next">
            <div className="rejection-text">{rejectionLine}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 600;

// Play the "you can swipe me" swing only on the very first card of the session.
let swipeHintPlayed = false;

interface SwipeCardProps {
  place: mapkit.Place;
  info: PlaceInfo;
  isTopPick: boolean;
  pickNumber: number;
  token: string;
  userCoordinates: Coordinate | undefined;
  onSkip: () => void;
  onPick: () => void;
}

// One swipeable card. Each pick gets its own keyed instance (and thus its own
// motion value), so a card flinging off-screen never interferes with the next
// one entering. Swipe left = skip, swipe right = accept (lock in the pick and
// reveal the map); the buttons below remain as an accessible fallback.
function SwipeCard({
  place,
  info,
  isTopPick,
  pickNumber,
  token,
  userCoordinates,
  onSkip,
  onPick,
}: SwipeCardProps) {
  const openNow = deriveOpenNow(info.hours, info.openNow);
  const distanceMeters = userCoordinates
    ? haversineMeters(
        userCoordinates.latitude,
        userCoordinates.longitude,
        place.coordinate.latitude,
        place.coordinate.longitude
      )
    : null;
  // Stable per pick — the label rotates when the place changes, not on every render.
  const softRejectLabel = useMemo(
    () =>
      SOFT_REJECT_LABELS[Math.floor(Math.random() * SOFT_REJECT_LABELS.length)],
    []
  );
  const [imgFailed, setImgFailed] = useState(false);
  const hasPhoto = !!info.photoUrl && !imgFailed;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const acceptStampOpacity = useTransform(x, [30, 140], [0, 1]);
  const skipStampOpacity = useTransform(x, [-140, -30], [1, 0]);

  const springBack = () =>
    animate(x, 0, { type: "spring", stiffness: 350, damping: 32 });

  // On first load, swing the card right→left→center once so the swipe gesture
  // is discoverable. Fires only for the first card and bows out the moment the
  // user grabs it.
  const hintControls = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => {
    if (swipeHintPlayed) return;
    swipeHintPlayed = true;
    const controls = animate(x, [0, 70, -56, 0], {
      duration: 1.2,
      ease: "easeInOut",
      times: [0, 0.38, 0.72, 1],
      delay: 0.55,
    });
    hintControls.current = controls;
    return () => controls.stop();
  }, [x]);

  const handleDragEnd = (_e: unknown, infoPan: PanInfo) => {
    const { offset, velocity } = infoPan;
    if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      track("pick_swiped", { direction: "accept" });
      // Don't spring back — let the card ride the deck's exit into the map view.
      onPick();
    } else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      track("pick_swiped", { direction: "skip" });
      const w = typeof window !== "undefined" ? window.innerWidth : 800;
      animate(x, -w * 1.2, { duration: 0.32, ease: "easeIn" });
      onSkip();
    } else {
      springBack();
    }
  };

  return (
    <motion.div
      className="swipe-card"
      style={{ x, rotate }}
      drag="x"
      dragElastic={0.5}
      dragMomentum={false}
      onDragStart={() => hintControls.current?.stop()}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.94, y: 14, opacity: 0.5 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <div
        className={`swipe-card-media${
          hasPhoto ? "" : " swipe-card-media--noimg"
        }`}
      >
        {hasPhoto ? (
          <img
            className="swipe-card-photo"
            src={info.photoUrl!}
            alt={info.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          // No Yelp photo — fall back to a static map of the place as the visual.
          <CardLocationMap token={token} place={place} isTopPick={isTopPick} />
        )}
        <div className="swipe-card-scrim" />

        <motion.div
          className="swipe-stamp swipe-stamp--accept"
          style={{ opacity: acceptStampOpacity }}
        >
          I&apos;m in →
        </motion.div>
        <motion.div
          className="swipe-stamp swipe-stamp--skip"
          style={{ opacity: skipStampOpacity }}
        >
          {softRejectLabel}
        </motion.div>

        <div className="result-card-header">
          {isTopPick ? (
            <span className="chip chip--toppick">★ Top Pick</span>
          ) : (
            <span className="chip chip--muted">
              Pick №{String(pickNumber).padStart(3, "0")}
            </span>
          )}
          <div className="result-card-header-right">
            {openNow === true && (
              <span className="chip chip--green">● Open now</span>
            )}
            {openNow === false && (
              <span className="chip chip--muted">● Closed</span>
            )}
          </div>
        </div>

        <div className="swipe-card-media-foot">
          <div className="result-headline">
            GO EAT<br />
            <span>{info.name}.</span>
          </div>

          <div className="result-tags">
            <span className="chip chip--card">
              {info.categoryDisplayName || "Restaurant"}
            </span>
            {info.priceLevel && (
              <span className="chip chip--card">{info.priceLevel}</span>
            )}
            {info.rating != null && (
              <span className="chip chip--card">★ {info.rating.toFixed(1)}</span>
            )}
            {distanceMeters != null && (
              <span className="chip chip--card">
                {formatDistanceMi(distanceMeters)} away
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="swipe-card-actions">
        <div className="result-swipe-hint">← skip · pick →</div>
        <div className="swipe-card-buttons">
          <button className="btn-next" onClick={onSkip}>
            {softRejectLabel}
          </button>
          <button className="btn-take-me" onClick={onPick}>
            I&apos;m in →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// A heavily-blurred, non-interactive map of the user's area painted behind the
// deck (desktop only, via CSS) to break up the flat background. Keyed on the
// center so it doesn't re-mount as the user swipes through picks.
function DeckBackgroundMap({
  token,
  center,
  isTopPick,
}: {
  token: string;
  center: { latitude: number; longitude: number };
  isTopPick: boolean;
}) {
  return (
    <div
      className={`swipe-deck-bg${isTopPick ? " swipe-deck-bg--toppick" : ""}`}
      aria-hidden
    >
      <div className="swipe-deck-bg-map">
        <MapKitMap
          token={token}
          colorScheme={isTopPick ? ColorScheme.Dark : ColorScheme.Light}
          initialRegion={{
            centerLatitude: center.latitude,
            centerLongitude: center.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          isScrollEnabled={false}
          isZoomEnabled={false}
          isRotationEnabled={false}
          showsCompass={0}
          showsMapTypeControl={false}
          showsZoomControl={false}
          showsUserLocationControl={false}
        />
      </div>
    </div>
  );
}

// A non-interactive map centered on the place, used as the card's visual when
// there's no Yelp photo. Pointer-events are disabled in CSS so the card stays
// draggable when the grab starts over the map.
function CardLocationMap({
  token,
  place,
  isTopPick,
}: {
  token: string;
  place: mapkit.Place;
  isTopPick: boolean;
}) {
  return (
    <div className="swipe-card-map" aria-hidden>
      <MapKitMap
        token={token}
        colorScheme={isTopPick ? ColorScheme.Dark : ColorScheme.Light}
        initialRegion={{
          centerLatitude: place.coordinate.latitude,
          centerLongitude: place.coordinate.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        isScrollEnabled={false}
        isZoomEnabled={false}
        isRotationEnabled={false}
        showsCompass={0}
        showsMapTypeControl={false}
        showsZoomControl={false}
        showsUserLocationControl={false}
      >
        <Marker
          latitude={place.coordinate.latitude}
          longitude={place.coordinate.longitude}
          color={isTopPick ? GOLD : ACCENT}
          glyphText="★"
        />
      </MapKitMap>
    </div>
  );
}

// -- Picked phase: the map + full results (no deck) --

interface ResultMediaProps {
  place: mapkit.Place;
  name: string;
  photos: string[];
  isTopPick: boolean;
  token: string;
  mapRef: React.RefObject<mapkit.Map | null>;
  userCoordinates: Coordinate | undefined;
  routePoints: Coordinate[][];
  routeInfo: { distanceMeters: number; durationSeconds: number } | null;
  onMapLoad: () => void;
  onUserLocationChange: (event: UserLocationChangeEvent) => void;
  onUserLocationError: (event?: UserLocationErrorEvent) => void;
}

// The hero area of the picked view: a swipeable carousel of [route map, ...Yelp
// photos] (up to 3). When at least one photo exists the map is locked
// (non-interactive, pointer-events off in CSS) so a horizontal drag swipes
// between slides instead of panning the map; with no photo it's the lone,
// fully-interactive map.
function ResultMedia({
  place,
  name,
  photos,
  isTopPick,
  token,
  mapRef,
  userCoordinates,
  routePoints,
  routeInfo,
  onMapLoad,
  onUserLocationChange,
  onUserLocationError,
}: ResultMediaProps) {
  // Drop any individual photo that fails to load (keyed by URL).
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const validPhotos = photos.filter((p) => !failedPhotos.has(p));
  const slideCount = 1 + validPhotos.length;
  const markerColor = isTopPick ? GOLD : ACCENT;

  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const x = useMotionValue(0);

  // The picked map is normally framed by the parent's fit-to-route effect, but
  // that effect doesn't re-run when this map remounts (e.g. opening the location
  // changer then returning to the pick). Without an initial region a fresh mount
  // boots at MapKit's default 0,0 (null island, off Africa) — so seed it to
  // frame the place (and the user, when known).
  const initialRegion = useMemo(() => {
    const pts = userCoordinates
      ? [place.coordinate, userCoordinates]
      : [place.coordinate];
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of pts) {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    }
    const latPad = Math.max((maxLat - minLat) * 0.4, 0.01);
    const lngPad = Math.max((maxLng - minLng) * 0.4, 0.01);
    return {
      centerLatitude: (minLat + maxLat) / 2,
      centerLongitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + latPad * 2,
      longitudeDelta: maxLng - minLng + lngPad * 2,
    };
  }, [
    place.coordinate.latitude,
    place.coordinate.longitude,
    userCoordinates?.latitude,
    userCoordinates?.longitude,
  ]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the track snapped to the current slide as width/index change.
  useEffect(() => {
    x.set(-index * width);
  }, [width, index, x]);

  // If a photo errors out, its slide disappears — keep the index in range.
  useEffect(() => {
    if (index > slideCount - 1) setIndex(slideCount - 1);
  }, [slideCount, index]);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, i));
    setIndex(clamped);
    animate(x, -clamped * width, { type: "spring", stiffness: 320, damping: 36 });
  };

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const threshold = Math.max(40, width * 0.2);
    if (info.offset.x < -threshold || info.velocity.x < -500) goTo(index + 1);
    else if (info.offset.x > threshold || info.velocity.x > 500) goTo(index - 1);
    else goTo(index);
  };

  return (
    <div className="result-media" ref={viewportRef}>
      <motion.div
        className="result-media-track"
        style={{ x }}
        drag={slideCount > 1 ? "x" : false}
        dragConstraints={{ left: -(slideCount - 1) * width, right: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
      >
        <div className="result-media-slide">
          <div
            className={`result-media-map${
              slideCount > 1 ? " result-media-map--locked" : ""
            }`}
          >
            <MapKitMap
              ref={mapRef}
              token={token}
              showsUserLocation
              initialRegion={initialRegion}
              colorScheme={isTopPick ? ColorScheme.Dark : ColorScheme.Light}
              isScrollEnabled={slideCount === 1}
              isZoomEnabled={slideCount === 1}
              isRotationEnabled={slideCount === 1}
              showsCompass={0}
              showsMapTypeControl={false}
              showsZoomControl={false}
              onLoad={onMapLoad}
              onUserLocationChange={onUserLocationChange}
              onUserLocationError={onUserLocationError}
            >
              {userCoordinates && (
                <Marker
                  latitude={userCoordinates.latitude}
                  longitude={userCoordinates.longitude}
                  color={markerColor}
                  glyphText="📍"
                />
              )}
              <Marker
                latitude={place.coordinate.latitude}
                longitude={place.coordinate.longitude}
                color={markerColor}
                glyphText="★"
                title={place.name}
                subtitle={place.formattedAddress}
              />
              {routePoints.map((points, i) => (
                <Polyline
                  key={`route-${i}`}
                  points={points}
                  lineWidth={5}
                  strokeColor={markerColor}
                />
              ))}
            </MapKitMap>
          </div>
        </div>

        {validPhotos.map((src, i) => (
          <div className="result-media-slide" key={src}>
            <img
              className="result-media-photo"
              src={src}
              alt={`${name} photo ${i + 1}`}
              loading="lazy"
              // Block the browser's native image ghost-drag, which otherwise
              // hijacks the pointer and stops the carousel from swiping back.
              draggable={false}
              onError={() =>
                setFailedPhotos((prev) => new Set(prev).add(src))
              }
            />
          </div>
        ))}
      </motion.div>

      {/* Map context chips — shown over the map on the desktop two-pane layout
          (hidden on mobile, where the name lives in the sheet). */}
      <div className="result-map-chips">
        <span className="chip chip--white">📍 You</span>
        <span
          className="chip chip--white"
          style={{ color: isTopPick ? GOLD : "var(--accent)" }}
        >
          ★ {name}
        </span>
        {routeInfo && (
          <span className="chip chip--white">
            {formatDriveMinutes(routeInfo.durationSeconds)}
          </span>
        )}
      </div>

      {slideCount > 1 && (
        <div className="result-media-dots">
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`result-media-dot${
                i === index ? " result-media-dot--active" : ""
              }`}
              aria-label={i === 0 ? "Show map" : `Show photo ${i}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultDetail({
  place,
  recommendation,
  pickNumber,
  showMapPicker,
  mapServices,
  onToggleMapPicker,
  onCloseMapPicker,
  onBack,
  onShare,
  mapPickerRef,
  mapRef,
  token,
  userCoordinates,
  routePoints,
  routeInfo,
  onMapLoad,
  onUserLocationChange,
  onUserLocationError,
}: ResultScreenProps) {
  const shareEnabled = useFeatureFlag("share-enabled");
  const info = getPlaceInfo(place, recommendation);
  const openNow = deriveOpenNow(info.hours, info.openNow);
  const hoursBlurb = formatHoursBlurb(info.hours, info.openNow);
  const isTopPick = recommendation?.source === "top_pick";

  // Status chips (pick number / open-closed / share). They live in the content
  // card on both layouts; the map shows the You/place/drive context chips.
  const headerChips = (
    <>
      {isTopPick ? (
        <span className="chip chip--toppick">★ Top Pick</span>
      ) : (
        <span className="chip chip--muted">
          Pick №{String(pickNumber).padStart(3, "0")}
        </span>
      )}
      <div className="result-card-header-right">
        {openNow === true && (
          <span className="chip chip--green">● Open now</span>
        )}
        {openNow === false && (
          <span className="chip chip--muted">● Closed</span>
        )}
        {shareEnabled && (
          <button
            className="btn-share"
            onClick={() => {
              track("share_clicked");
              onShare();
            }}
          >
            ↗ Share
          </button>
        )}
      </div>
    </>
  );

  return (
    <div
      className={`result-layout result-layout--sheet${
        isTopPick ? " result-layout--toppick" : ""
      }`}
    >
      {/* A one-shot gold wash that flashes over the layout the moment a top pick
          is accepted (this view mounts) — rewards the commitment. */}
      {isTopPick && (
        <motion.div
          className="result-toppick-wash"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 0.9, times: [0, 0.3, 1], ease: "easeOut" }}
        />
      )}

      {/* Mobile: full-bleed photo/map hero. Desktop: a floating rounded map
          card. The You/place/drive context chips sit over the map; status chips
          live in the content card below. */}
      <div className="result-hero">
        <ResultMedia
          place={place}
          name={info.name}
          photos={info.photos}
          isTopPick={isTopPick}
          token={token}
          mapRef={mapRef}
          userCoordinates={userCoordinates}
          routePoints={routePoints}
          routeInfo={routeInfo}
          onMapLoad={onMapLoad}
          onUserLocationChange={onUserLocationChange}
          onUserLocationError={onUserLocationError}
        />
      </div>

      <div className="result-card">
        <div className="result-card-header">{headerChips}</div>

        <div className="result-headline">
          GO EAT<br />
          <span>{info.name}.</span>
        </div>

        <div className="result-subtext">
          {isTopPick
            ? "You unlocked a top pick. Don’t waste this."
            : "That’s our final answer. We won’t be taking questions."}
        </div>

        <div className="result-tags">
          <span className="chip chip--card">
            {info.categoryDisplayName || "Restaurant"}
          </span>
          {info.priceLevel && (
            <span className="chip chip--card">{info.priceLevel}</span>
          )}
          {info.rating != null && (
            <span className="chip chip--card">★ {info.rating.toFixed(1)}</span>
          )}
          {routeInfo && (
            <span className="chip chip--card">
              {formatDistanceMi(routeInfo.distanceMeters)}
            </span>
          )}
          {routeInfo && (
            <span className="chip chip--card">
              {formatDriveMinutes(routeInfo.durationSeconds)}
            </span>
          )}
        </div>

        <div className="result-details-grid">
          <div>
            <div className="detail-label">Address</div>
            <div className="detail-value">{info.address}</div>
          </div>
          <div>
            <div className="detail-label">Phone</div>
            <div className="detail-value">
              {info.phone && info.phone !== "N/A" ? (
                <a href={`tel:${info.phone.replace(/[^\d+]/g, "")}`}>
                  {formatPhone(info.phone)}
                </a>
              ) : (
                info.phone
              )}
            </div>
          </div>
          <div>
            <div className="detail-label">Website</div>
            <div className="detail-value">
              {info.website ? (
                <a href={info.website} target="_blank" rel="noopener noreferrer">
                  {info.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "N/A"
              )}
            </div>
          </div>
          {hoursBlurb && (
            <div>
              <div className="detail-label">Hours</div>
              <div className="detail-value">{hoursBlurb}</div>
            </div>
          )}
        </div>

        {isTopPick && (
          <div className="toppick-why">
            <span className="toppick-why-star">★</span>
            <div>
              <div className="toppick-why-title">Why this is a top pick</div>
              <div className="toppick-why-body">
                {recommendation?.blurb ||
                  "Hand-picked. We almost never say that."}
              </div>
            </div>
          </div>
        )}

        <div className="detail-actions">
          <div className="map-picker-wrapper" ref={mapPickerRef}>
            <button
              className="btn-take-me"
              onClick={() => {
                track("take_me_there_clicked");
                onToggleMapPicker();
              }}
            >
              Take me there →
            </button>
            {showMapPicker && (
              <div className="map-picker-dropdown">
                {mapServices.map((service) => (
                  <a
                    key={service.name}
                    className="map-picker-option"
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      track("map_service_selected", { service: service.name });
                      bumpSession("tookDirections");
                      onCloseMapPicker();
                    }}
                  >
                    {service.name}
                  </a>
                ))}
              </div>
            )}
          </div>
          <button className="btn-back" onClick={onBack}>
            ← Pick again
          </button>
        </div>
      </div>
    </div>
  );
}
