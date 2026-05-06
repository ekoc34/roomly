import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import type { Listing } from "@/types/database";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CITY_COORDS: Record<string, [number, number]> = {
  amsterdam: [52.3676, 4.9041],
  rotterdam: [51.9225, 4.4792],
  "den haag": [52.0705, 4.3007],
  "the hague": [52.0705, 4.3007],
  utrecht: [52.0907, 5.1214],
  eindhoven: [51.4416, 5.4697],
  groningen: [53.2194, 6.5665],
  tilburg: [51.5555, 5.0913],
  almere: [52.3508, 5.2647],
  breda: [51.5719, 4.7683],
  nijmegen: [51.8426, 5.8546],
  leiden: [52.1601, 4.4970],
  delft: [51.9999, 4.3631],
  haarlem: [52.3874, 4.6462],
  maastricht: [50.8514, 5.6910],
  arnhem: [51.9851, 5.8987],
  enschede: [52.2215, 6.8937],
  zwolle: [52.5168, 6.0830],
  amersfoort: [52.1561, 5.3878],
  "den bosch": [51.6978, 5.3037],
  "'s-hertogenbosch": [51.6978, 5.3037],
  apeldoorn: [52.2112, 5.9699],
};

function guessCoords(location: string): [number, number] | null {
  const lower = location.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

export function MapPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setListings((data ?? []) as Listing[]);
        setLoading(false);
      });
  }, []);

  const mappable = listings
    .map((l) => ({ listing: l, coords: guessCoords(l.location) }))
    .filter((x): x is { listing: Listing; coords: [number, number] } => x.coords !== null);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-base font-semibold text-stone-900">Kaartoverzicht</h1>
          <p className="text-xs text-stone-500">
            {loading ? "Laden…" : `${mappable.length} van ${listings.length} woningen zichtbaar op kaart`}
          </p>
        </div>
        <Link
          href="/kamers"
          className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Lijstweergave
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center bg-stone-100">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
            <p className="text-sm text-stone-500">Kaart laden…</p>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <MapContainer
            center={[52.3, 5.3]}
            zoom={8}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mappable.map(({ listing, coords }) => (
              <Marker key={listing.id} position={coords}>
                <Popup maxWidth={240} className="leaflet-popup-roomly">
                  <div className="min-w-[180px]">
                    {listing.images[0] && (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="mb-2 h-24 w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="text-sm font-semibold leading-snug text-stone-900 line-clamp-2">
                      {listing.title}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">{listing.location}</p>
                    <p className="mt-1 text-base font-black text-rose-600">
                      €{Number(listing.price).toFixed(0)}<span className="text-xs font-normal text-stone-400"> /mnd</span>
                    </p>
                    <Link
                      href={`/kamers/${listing.id}`}
                      className="mt-2 block w-full rounded-lg bg-rose-500 py-1.5 text-center text-xs font-semibold text-white hover:bg-rose-600"
                    >
                      Bekijk advertentie →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
