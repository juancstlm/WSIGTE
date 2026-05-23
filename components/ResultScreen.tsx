import { useMemo } from "react";
import {
  ColorScheme,
  Map as MapKitMap,
  Marker,
  Polyline,
} from "mapkit-react";
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
  };
}

function formatDistanceMi(meters: number): string {
  const mi = meters / 1609.344;
  return mi < 0.1 ? `${(meters / 0.3048).toFixed(0)} FT` : `${mi.toFixed(1)} MI`;
}

function formatDriveMinutes(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} MIN DRIVE`;
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

export interface ResultScreenProps {
  place: mapkit.Place;
  recommendation: RecommendationResult | null;
  pickNumber: number;
  rejecting: boolean;
  rejectionLine: string;
  showMapPicker: boolean;
  mapServices: Array<{ name: string; url: string }>;
  onToggleMapPicker: () => void;
  onCloseMapPicker: () => void;
  onReject: () => void;
  onSkip: () => void;
  onWrongLocation: () => void;
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

export function ResultScreen({
  place,
  recommendation,
  pickNumber,
  rejecting,
  rejectionLine,
  showMapPicker,
  mapServices,
  onToggleMapPicker,
  onCloseMapPicker,
  onReject,
  onSkip,
  onWrongLocation,
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
  const shareEnabled = useFeatureFlag('share-enabled')
  const info = getPlaceInfo(place, recommendation);
  const openNow = deriveOpenNow(info.hours, info.openNow);
  const hoursBlurb = formatHoursBlurb(info.hours, info.openNow);
  const isTopPick = recommendation?.source === "top_pick";
  const markerColor = isTopPick ? GOLD : ACCENT;
  // Stable per pick — the label rotates when the place changes, not on every render.
  const softRejectLabel = useMemo(
    () =>
      SOFT_REJECT_LABELS[Math.floor(Math.random() * SOFT_REJECT_LABELS.length)],
    [place.id]
  );

  return (
    <div className={`result-layout${isTopPick ? " result-layout--toppick" : ""}`}>
      <div className="result-map-area">
        <div className="result-map-inner">
          <MapKitMap
            ref={mapRef}
            token={token}
            showsUserLocation
            colorScheme={isTopPick ? ColorScheme.Dark : ColorScheme.Light}
            onLoad={onMapLoad}
            onUserLocationChange={onUserLocationChange}
            onUserLocationError={onUserLocationError}
          >
            {userCoordinates && place && (
              <Marker
                latitude={userCoordinates.latitude}
                longitude={userCoordinates.longitude}
                color={markerColor}
                glyphText="📍"
              />
            )}
            {place && (
              <Marker
                latitude={place.coordinate.latitude}
                longitude={place.coordinate.longitude}
                color={markerColor}
                glyphText="★"
                title={place.name}
                subtitle={place.formattedAddress}
              />
            )}
            {routePoints.map((points, i) => (
              <Polyline
                key={`route-${i}`}
                points={points}
                lineWidth={5}
                strokeColor={markerColor}
              />
            ))}
          </MapKitMap>
          <div className="result-map-chips">
            <span className="chip chip--white">📍 You</span>
            <span
              className="chip chip--white"
              style={{ color: isTopPick ? GOLD : "var(--accent)" }}
            >
              ★ {info.name}
            </span>
            {routeInfo && (
              <span className="chip chip--white">
                {formatDriveMinutes(routeInfo.durationSeconds)}
              </span>
            )}
          </div>
          {rejecting && (
            <div className="rejection-overlay">
              <div className="rejection-text">{rejectionLine}</div>
            </div>
          )}
        </div>
      </div>

      <div className="result-card">
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
            {shareEnabled && <button
              className="btn-share"
              onClick={() => {
                track("share_clicked");
                onShare();
              }}
            >
              ↗ Share
            </button>}
          </div>
        </div>

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
        </div>

        <div className="result-details-grid">
          <div>
            <div className="detail-label">Address</div>
            <div className="detail-value">{info.address}</div>
          </div>
          <div>
            <div className="detail-label">Phone</div>
            <div className="detail-value">{info.phone}</div>
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

        <div style={{ flex: 1 }} />

        <div className="result-actions">
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
          <button className="btn-next" onClick={onSkip}>
            {softRejectLabel}
          </button>
          <button className="btn-awful" onClick={onReject}>
            That&apos;s awful
          </button>
        </div>
        <button
          className="btn-wrong-location-link"
          onClick={onWrongLocation}
        >
          Wrong location?
        </button>
      </div>
    </div>
  );
}
