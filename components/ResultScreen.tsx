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
import type { RecommendationResult } from "../shared/api";
import { SOFT_REJECT_LABELS } from "../shared/constants";

export interface PlaceInfo {
  name: string;
  address: string;
  phone: string;
  website: string;
  urls: string[];
}

export function getPlaceInfo(place: mapkit.Place): PlaceInfo {
  return {
    name: place.name,
    address: place.formattedAddress,
    phone: place.telephone || "N/A",
    website: place.urls?.[0] || "",
    urls: place.urls || [],
  };
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
  onMapLoad,
  onUserLocationChange,
  onUserLocationError,
}: ResultScreenProps) {
  const info = getPlaceInfo(place);
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
          <div className="result-card-header-right" />
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
          <span className="chip chip--card">Restaurant</span>
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
