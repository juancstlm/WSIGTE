import { useState, useEffect, useMemo } from "react";
import { Map as MapKitMap, Marker, Polyline } from "mapkit-react";
import type { Coordinate } from "mapkit-react";
import { Header } from "./Header";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const SITE_URL = "https://wsigte.com";

interface ShareScreenProps {
  place: mapkit.Place;
  token: string;
  userCoordinates?: Coordinate;
  routePoints: Coordinate[][];
  onClose: () => void;
}

function getAppleMapsPlaceId(place: mapkit.Place): string {
  return place.id;
}

function ShareIcon({ kind, size = 24 }: { kind: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "sms":
      return (
        <svg {...common}>
          <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.7-5.2A8.5 8.5 0 1 1 21 12Z" />
          <path
            d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1-1 1c-1 0-2-1-2-2l1-1-1-2L9 10Z"
            fill="#fff"
            stroke="none"
          />
        </svg>
      );
    case "twitter":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
          <path d="M18.244 2H21l-6.5 7.43L22 22h-6.81l-4.74-6.2L4.8 22H2l7-8L2 2h6.95l4.3 5.67L18.244 2Zm-1.19 18h1.86L7.04 4H5.06l11.99 16Z" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5" />
          <path d="M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5" />
        </svg>
      );
    default:
      return null;
  }
}

function buildShareUrl(shortId: string) {
  return `${SITE_URL}/p/${shortId}`;
}

function buildShareActions(shortId: string, message: string) {
  const url = buildShareUrl(shortId);
  const text = `${message}\n${url}`;
  const encoded = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  const encodedMsg = encodeURIComponent(message);

  return [
    {
      icon: "sms" as const,
      label: "Messages",
      bg: "#1F7A4D",
      href: `sms:?&body=${encoded}`,
    },
    {
      icon: "whatsapp" as const,
      label: "WhatsApp",
      bg: "#25D366",
      href: `https://wa.me/?text=${encoded}`,
    },
    {
      icon: "mail" as const,
      label: "Email",
      bg: "#2D5BD8",
      href: `mailto:?subject=${encodeURIComponent("Where we're eating")}&body=${encoded}`,
    },
    {
      icon: "twitter" as const,
      label: "X",
      bg: "#15130F",
      href: `https://x.com/intent/tweet?text=${encodedMsg}&url=${encodedUrl}`,
    },
    {
      icon: "link" as const,
      label: "More…",
      bg: "#E04A2A",
      href: null,
    },
  ];
}

export function ShareScreen({ place, token, userCoordinates, routePoints, onClose }: ShareScreenProps) {
  const name = place.name;
  const address = place.formattedAddress;

  const mapRegion = useMemo(() => {
    const points: Array<{ latitude: number; longitude: number }> = [
      { latitude: place.coordinate.latitude, longitude: place.coordinate.longitude },
    ];
    if (userCoordinates) points.push(userCoordinates);
    for (const seg of routePoints) points.push(...seg);

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of points) {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    }
    const latPad = Math.max((maxLat - minLat) * 0.4, 0.005);
    const lngPad = Math.max((maxLng - minLng) * 0.4, 0.005);
    return {
      centerLatitude: (minLat + maxLat) / 2,
      centerLongitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) + latPad * 2,
      longitudeDelta: (maxLng - minLng) + lngPad * 2,
    };
  }, [place, userCoordinates, routePoints]);

  const [shortId, setShortId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(
    `The internet has decided we're eating at ${name}. Don't argue.`
  );

  useEffect(() => {
    const body = {
      appleMapsPlaceId: getAppleMapsPlaceId(place),
      name: place.name,
      address: place.formattedAddress,
      latitude: place.coordinate.latitude,
      longitude: place.coordinate.longitude,
    };

    fetch(`${API_BASE_URL}/v1/places`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => setShortId(data.shortId))
      .catch((err) => console.error("Failed to create share link:", err));
  }, [place]);

  const shareUrl = shortId ? buildShareUrl(shortId) : null;
  const displayUrl = shortId ? `wsigte.com/p/${shortId}` : "generating link…";

  const handleCopy = () => {
    if (!shareUrl || !navigator.clipboard) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !navigator.share) return;
    try {
      await navigator.share({ title: `Eat at ${name}`, text: message, url: shareUrl });
    } catch {}
  };

  const actions = shortId ? buildShareActions(shortId, message) : [];

  return (
    <div className="app-root">
      <Header />

      <div className="share-layout">
        {/* Left: postcard preview */}
        <div className="share-preview">
          <div style={{ alignSelf: "flex-end", maxWidth: 360, width: "100%" }}>
            <span className="chip chip--muted">What they&apos;ll see</span>
          </div>
          <div className="share-preview-inner" style={{ alignSelf: "flex-end" }}>
            <div className="share-card">
              <div className="share-card-map">
                <MapKitMap
                  token={token}
                  initialRegion={mapRegion}
                  isScrollEnabled={false}
                  isZoomEnabled={false}
                  isRotationEnabled={false}
                  showsCompass={0}
                  showsMapTypeControl={false}
                  showsZoomControl={false}
                >
                  {userCoordinates && (
                    <Marker
                      latitude={userCoordinates.latitude}
                      longitude={userCoordinates.longitude}
                      color="#E04A2A"
                      glyphText="📍"
                    />
                  )}
                  <Marker
                    latitude={place.coordinate.latitude}
                    longitude={place.coordinate.longitude}
                    color="#E04A2A"
                    title={place.name}
                  />
                  {routePoints.map((points, i) => (
                    <Polyline
                      key={`share-route-${i}`}
                      points={points}
                      lineWidth={3}
                      strokeColor="#E04A2A"
                    />
                  ))}
                </MapKitMap>
                <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
                  <span className="chip chip--white" style={{ color: "var(--accent)" }}>
                    ★ pick
                  </span>
                </div>
              </div>
              <div className="share-card-body">
                <div className="share-card-label">A friend says you should</div>
                <div className="share-card-headline">
                  GO EAT<br />
                  <span>{name}.</span>
                </div>
                <div className="share-card-tags">
                  <span className="chip" style={{ background: "var(--bg)" }}>
                    Restaurant
                  </span>
                </div>
                <div className="share-card-address">{address}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: share controls */}
        <div className="share-controls">
          <button className="btn-back" onClick={onClose}>
            ← Back to result
          </button>

          <div className="share-headline">
            TELL<br />SOMEONE.
          </div>
          <div className="share-subtext">
            Send your verdict to whoever&apos;s been waffling about lunch for
            forty minutes.
          </div>

          <div>
            <div className="share-message-label">Your message</div>
            <textarea
              className="share-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
          </div>

          <div className="share-tiles">
            {actions.map((tile) => (
              tile.href ? (
                <a
                  key={tile.label}
                  className="share-tile"
                  href={tile.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div
                    className="share-tile-icon"
                    style={{ background: tile.bg }}
                  >
                    <ShareIcon kind={tile.icon} />
                  </div>
                  <div className="share-tile-label">{tile.label}</div>
                </a>
              ) : (
                <button
                  key={tile.label}
                  className="share-tile"
                  onClick={handleNativeShare}
                >
                  <div
                    className="share-tile-icon"
                    style={{ background: tile.bg }}
                  >
                    <ShareIcon kind={tile.icon} />
                  </div>
                  <div className="share-tile-label">{tile.label}</div>
                </button>
              )
            ))}
          </div>

          <div className="share-link-row">
            <div className="share-link-url">{displayUrl}</div>
            <button
              className={`btn-copy${copied ? " btn-copy--copied" : ""}`}
              onClick={handleCopy}
              disabled={!shortId}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <div className="share-vote-cta">
            <div>
              <div className="share-vote-title">Make it a vote</div>
              <div className="share-vote-desc">
                Send three picks. Friends rank. Loudest wins.
              </div>
            </div>
            <button className="btn-vote">Start vote →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
