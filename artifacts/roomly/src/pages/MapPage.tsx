import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearch } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/lib/supabase";
import type { Listing } from "@/types/database";

if (typeof L !== "undefined" && L.Icon && L.Icon.Default) {
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

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
  leiden: [52.1601, 4.497],
  delft: [51.9999, 4.3631],
  haarlem: [52.3874, 4.6462],
  maastricht: [50.8514, 5.691],
  arnhem: [51.9851, 5.8987],
  enschede: [52.2215, 6.8937],
  zwolle: [52.5168, 6.083],
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

const geocodeCache = new Map<string, [number, number] | null>();

async function geocodeNominatim(location: string): Promise<[number, number] | null> {
  if (geocodeCache.has(location)) return geocodeCache.get(location) ?? null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&countrycodes=nl&format=json&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "nl" } });
    if (!res.ok) { geocodeCache.set(location, null); return null; }
    const data = await res.json();
    if (!data.length) { geocodeCache.set(location, null); return null; }
    const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    geocodeCache.set(location, coords);
    return coords;
  } catch {
    geocodeCache.set(location, null);
    return null;
  }
}

function FitBoundsController({ positions }: { positions: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    map.fitBounds(positions, { padding: [50, 50], maxZoom: 16 });
  }, [map, positions]);
  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    map.on("zoomend", handler);
    return () => { map.off("zoomend", handler); };
  }, [map, onZoom]);
  return null;
}

export function MapPage() {
  const searchString = useSearch();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<Map<string, [number, number]>>(new Map());
  const [fitTarget, setFitTarget] = useState<[number, number][] | null>(null);
  const [zoom, setZoom] = useState(8);
  const [mapTab, setMapTab] = useState<"woningen" | "huisgenoten">("woningen");
  const geocodingActive = { current: false };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);

    const params = new URLSearchParams(searchString);
    const q = params.get("q") ?? "";
    const type = params.get("type") ?? "";
    const district = params.get("district") ?? "";
    const minPrice = Number(params.get("min") ?? 0);
    const maxPrice = Number(params.get("max") ?? 10000);
    const pets = params.get("pets") ?? "";
    const smoking = params.get("smoking") ?? "";
    const gender = params.get("gender") ?? "";
    const rooms = params.get("rooms") ?? "";
    const minSurface = params.get("min_surface") ?? "";

    let query = supabase.from("listings").select("*");

    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`);
    if (type) query = query.eq("type", type);
    if (district) query = query.ilike("location", `%${district}%`);
    if (minPrice > 0) query = query.gte("price", minPrice);
    if (maxPrice < 10000) query = query.lte("price", maxPrice);
    if (pets === "1") query = query.eq("pets_allowed", true);
    if (smoking === "1") query = query.eq("smoking_allowed", true);
    if (gender) query = query.eq("gender_preference", gender);
    if (rooms) query = query.gte("rooms", Number(rooms));
    if (minSurface) query = query.gte("surface_area", Number(minSurface));

    query
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setListings((data ?? []) as Listing[]);
        setLoading(false);
      });
  }, [searchString]);

  useEffect(() => {
    if (!listings.length || geocodingActive.current) return;
    const needsGeocoding = listings.filter((l) => !guessCoords(l.location));
    if (!needsGeocoding.length) return;

    geocodingActive.current = true;
    Promise.all(
      needsGeocoding.map(async (l) => {
        const c = await geocodeNominatim(l.location);
        return { id: l.id, coords: c };
      })
    ).then((results) => {
      setCoords((prev) => {
        const next = new Map(prev);
        for (const { id, coords: c } of results) {
          if (c) next.set(id, c);
        }
        return next;
      });
      geocodingActive.current = false;
    });
  }, [listings]);

  const filteredListings = listings.filter((l) =>
    mapTab === "woningen"
      ? l.type === "room_for_rent" || l.type === "short_stay"
      : l.type === "roommate_search"
  );

  const mappable = filteredListings
    .map((l) => {
      const c = guessCoords(l.location) ?? coords.get(l.id) ?? null;
      return { listing: l, coords: c };
    })
    .filter((x): x is { listing: Listing; coords: [number, number] } => x.coords !== null);

  const clusterRadius = Math.min(0.05, 1.28 / Math.pow(2, zoom));
  const clusters: Array<{ center: [number, number]; listings: Listing[] }> = [];
  const clustered = new Set<string>();

  for (const item of mappable) {
    if (clustered.has(item.listing.id)) continue;
    const nearby = mappable.filter((other) => {
      if (clustered.has(other.listing.id)) return false;
      const dist = Math.sqrt(
        Math.pow(item.coords[0] - other.coords[0], 2) +
        Math.pow(item.coords[1] - other.coords[1], 2)
      );
      return dist < clusterRadius;
    });
    if (nearby.length > 1) {
      const centerLat = nearby.reduce((sum, n) => sum + n.coords[0], 0) / nearby.length;
      const centerLng = nearby.reduce((sum, n) => sum + n.coords[1], 0) / nearby.length;
      clusters.push({ center: [centerLat, centerLng], listings: nearby.map((n) => n.listing) });
      nearby.forEach((n) => clustered.add(n.listing.id));
    } else {
      clusters.push({ center: item.coords, listings: [item.listing] });
      clustered.add(item.listing.id);
    }
  }

  const listHref = searchString ? `/kamers?${searchString}` : "/kamers";

  return (
    <>
    <Helmet>
      <title>Kaartweergave — Welkthuis.nl</title>
    </Helmet>
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-base font-semibold text-stone-900">Kaartoverzicht</h1>
          <p className="text-xs text-stone-500">
            {loading ? "Laden…" : `${mappable.length} van ${filteredListings.length} woningen zichtbaar op kaart`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-stone-200 bg-stone-50 p-0.5">
            <button
              onClick={() => setMapTab("woningen")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${mapTab === "woningen" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
            >
              🏠 Woningen
            </button>
            <button
              onClick={() => setMapTab("huisgenoten")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${mapTab === "huisgenoten" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
            >
              🤝 Huisgenoten
            </button>
          </div>
          <Link
            href={listHref}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Bekijk als lijst
          </Link>
        </div>
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
            <FitBoundsController positions={fitTarget} />
            <ZoomTracker onZoom={setZoom} />
            {clusters.map((cluster, idx) => {
              const clusterCoords = cluster.listings
                .map((l) => guessCoords(l.location) ?? coords.get(l.id))
                .filter((c): c is [number, number] => c !== null);
              const allSameCoords =
                clusterCoords.length > 1 &&
                clusterCoords.every(
                  (c) =>
                    Math.abs(c[0] - clusterCoords[0][0]) < 0.0001 &&
                    Math.abs(c[1] - clusterCoords[0][1]) < 0.0001
                );
              return (
              <Marker
                key={idx}
                position={cluster.center}
                eventHandlers={{
                  click: () => {
                    if (cluster.listings.length > 1 && !allSameCoords) {
                      if (clusterCoords.length > 0) setFitTarget([...clusterCoords]);
                    }
                  },
                }}
              >
                {cluster.listings.length === 1 ? (
                  <Popup maxWidth={240} className="leaflet-popup-roomly">
                    <div className="min-w-[180px]">
                      {cluster.listings[0].images[0] && (
                        <img
                          src={cluster.listings[0].images[0]}
                          alt={cluster.listings[0].title}
                          className="mb-2 h-24 w-full rounded-lg object-cover"
                        />
                      )}
                      <p className="text-sm font-semibold leading-snug text-stone-900 line-clamp-2">
                        {cluster.listings[0].title}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">{cluster.listings[0].location}</p>
                      <p className="mt-1 text-base font-black text-rose-600">
                        €{Number(cluster.listings[0].price).toFixed(0)}<span className="text-xs font-normal text-stone-400"> /mnd</span>
                      </p>
                      <Link
                        href={`/kamers/${cluster.listings[0].id}`}
                        className="mt-2 block w-full rounded-lg bg-rose-500 py-1.5 text-center text-xs font-semibold text-white hover:bg-rose-600"
                      >
                        Bekijk advertentie →
                      </Link>
                    </div>
                  </Popup>
                ) : allSameCoords ? (
                  <Popup maxWidth={260}>
                    <p className="mb-2 text-sm font-semibold text-stone-900">{cluster.listings.length} woningen op deze locatie</p>
                    <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                      {cluster.listings.map((l) => (
                        <Link
                          key={l.id}
                          href={`/kamers/${l.id}`}
                          className="block rounded-lg border border-stone-100 bg-stone-50 px-2 py-1.5 hover:bg-rose-50"
                        >
                          <p className="text-xs font-semibold leading-snug text-stone-900 line-clamp-1">{l.title}</p>
                          <p className="text-xs text-rose-600 font-bold">€{Number(l.price).toFixed(0)}<span className="font-normal text-stone-400"> /mnd</span></p>
                        </Link>
                      ))}
                    </div>
                  </Popup>
                ) : (
                  <Popup maxWidth={240}>
                    <p className="text-sm font-semibold text-stone-900">{cluster.listings.length} woningen op deze locatie</p>
                    <p className="mt-1 text-xs text-stone-500">Klik op de marker om in te zoomen.</p>
                  </Popup>
                )}
              </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
    </>
  );
}
