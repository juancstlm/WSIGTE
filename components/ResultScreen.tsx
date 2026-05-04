import {
  Map as MapKitMap,
  Marker,
  Polyline,
} from "mapkit-react";
import type {
  Coordinate,
  UserLocationChangeEvent,
  UserLocationErrorEvent,
} from "mapkit-react";

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

export interface ResultScreenProps {
  place: mapkit.Place;
  pickNumber: number;
  rejecting: boolean;
  rejectionLine: string;
  showMapPicker: boolean;
  mapServices: Array<{ name: string; url: string }>;
  onToggleMapPicker: () => void;
  onCloseMapPicker: () => void;
  onReject: () => void;
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
  pickNumber,
  rejecting,
  rejectionLine,
  showMapPicker,
  mapServices,
  onToggleMapPicker,
  onCloseMapPicker,
  onReject,
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

  return (
    <div className="result-layout">
      <div className="result-map-area">
        <div className="result-map-inner">
          <MapKitMap
            ref={mapRef}
            token={token}
            showsUserLocation
            onLoad={onMapLoad}
            onUserLocationChange={onUserLocationChange}
            onUserLocationError={onUserLocationError}
          >
            {userCoordinates && place && (
              <Marker
                latitude={userCoordinates.latitude}
                longitude={userCoordinates.longitude}
                color="#E04A2A"
                glyphText="📍"
              />
            )}
            {place && (
              <Marker
                latitude={place.coordinate.latitude}
                longitude={place.coordinate.longitude}
                color="#E04A2A"
                title={place.name}
                subtitle={place.formattedAddress}
              />
            )}
            {routePoints.map((points, i) => (
              <Polyline
                key={`route-${i}`}
                points={points}
                lineWidth={5}
                strokeColor="#E04A2A"
              />
            ))}
          </MapKitMap>
          <div className="result-map-chips">
            <span className="chip chip--white">📍 You</span>
            <span className="chip chip--white" style={{ color: "var(--accent)" }}>
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
          <span className="chip chip--muted">
            Pick №{String(pickNumber).padStart(3, "0")}
          </span>
          <div className="result-card-header-right">
            {/* <span className="chip chip--green">● open now</span> */}
            {/* <button className="btn-share" onClick={onShare}>
              ↗ Share
            </button> */}
          </div>
        </div>

        <div className="result-headline">
          GO EAT<br />
          <span>{info.name}.</span>
        </div>

        <div className="result-subtext">
          That&apos;s our final answer. We won&apos;t be taking questions.
        </div>

        <div className="result-tags">
          <span className="chip chip--card">Restaurant</span>
          {/* <span className="chip chip--card">
            <span className="stars">
              {"★".repeat(Math.round(4.5))}
              <span className="stars-dim">{"★".repeat(5 - Math.round(4.5))}</span>
            </span>
          </span> */}
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
          {/* <div>
            <div className="detail-label">Hours</div>
            <div className="detail-value">Open now</div>
          </div> */}
        </div>

        <div style={{ flex: 1 }} />

        <div className="result-actions">
          <div className="map-picker-wrapper" ref={mapPickerRef}>
            <button className="btn-take-me" onClick={onToggleMapPicker}>
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
                    onClick={onCloseMapPicker}
                  >
                    {service.name}
                  </a>
                ))}
              </div>
            )}
          </div>
          <button className="btn-awful" onClick={onReject}>
            That&apos;s awful
          </button>
          <button className="btn-wrong-location" onClick={onWrongLocation}>
            Wrong location
          </button>
        </div>
      </div>
    </div>
  );
}
