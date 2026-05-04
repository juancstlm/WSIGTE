import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Header } from "../../components/Header";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

interface SharedPlace {
  shortId: string;
  appleMapsPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export default function SharedPlacePage() {
  const router = useRouter();
  const { id } = router.query;

  const [place, setPlace] = useState<SharedPlace | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetch(`${API_BASE_URL}/v1/places/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setPlace)
      .catch(() => setError(true));
  }, [id]);

  const appleMapsUrl = place
    ? `https://maps.apple.com/?daddr=${place.latitude},${place.longitude}&dirflg=d`
    : "";

  const googleMapsUrl = place
    ? `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=driving`
    : "";

  if (error) {
    return (
      <div className="app-root">
        <Header />
        <div className="shared-place-screen">
          <div className="shared-place-card">
            <div className="share-card-headline">LINK<br /><span>EXPIRED.</span></div>
            <div className="shared-place-subtext">
              This place link doesn&apos;t exist or has been removed.
            </div>
            <a href="/" className="btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 12 }}>
              Find somewhere to eat →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="app-root">
        <Header />
        <div className="shared-place-screen">
          <div className="shared-place-subtext">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`Eat at ${place.name} — WSIGTE`}</title>
        <meta name="description" content={`A friend says you should eat at ${place.name}. ${place.address}`} />
        <meta property="og:title" content={`Eat at ${place.name}`} />
        <meta property="og:description" content={`A friend says you should eat at ${place.name}. ${place.address}`} />
        <meta property="og:url" content={`https://wsigte.com/p/${place.shortId}`} />
      </Head>
      <div className="app-root">
        <Header />
        <div className="shared-place-screen">
          <div className="shared-place-card">
            <div className="share-card-label">A friend says you should</div>
            <div className="share-card-headline">
              GO EAT<br />
              <span>{place.name}.</span>
            </div>
            <div className="share-card-tags">
              <span className="chip" style={{ background: "var(--bg)" }}>
                Restaurant
              </span>
            </div>
            <div className="shared-place-address">{place.address}</div>

            <div className="shared-place-actions">
              <a
                href={appleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-take-me"
                style={{ textDecoration: "none", textAlign: "center" }}
              >
                Open in Apple Maps →
              </a>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wrong-location"
                style={{ textDecoration: "none", textAlign: "center" }}
              >
                Open in Google Maps
              </a>
            </div>

            <div className="shared-place-cta">
              <div className="shared-place-cta-text">Can&apos;t decide either?</div>
              <a href="/" className="btn-awful" style={{ textDecoration: "none", textAlign: "center" }}>
                Pick for me →
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
