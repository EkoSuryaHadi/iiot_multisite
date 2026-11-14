"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as LeafletNS from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Device, DeviceStatusItem, Site } from "@/lib/types";
import {
  Crosshair,
  ExternalLink,
  Factory,
  Globe,
  Layers,
  MapPin,
  Radio,
  Server,
  Signal,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type MapStyleKey = "street" | "light" | "satellite";

interface SiteWithLocation extends Site {
  lat: number;
  lng: number;
  hasExactCoords: boolean;
  devicesCount: number;
  onlineCount: number;
}

const CITY_LATLNG_PRESETS: Array<{ keys: string[]; lat: number; lng: number }> = [
  { keys: ["jakarta", "jkt"], lat: -6.2088, lng: 106.8456 },
  { keys: ["bandung", "bdg"], lat: -6.9175, lng: 107.6191 },
  { keys: ["semarang", "smg"], lat: -6.9667, lng: 110.4167 },
  { keys: ["surabaya", "sby"], lat: -7.2575, lng: 112.7521 },
  { keys: ["medan", "mdn"], lat: 3.5952, lng: 98.6722 },
  { keys: ["batam", "btm"], lat: 1.0456, lng: 104.0305 },
  { keys: ["pekanbaru", "pku"], lat: 0.5071, lng: 101.4478 },
  { keys: ["palembang", "plm"], lat: -2.9761, lng: 104.7754 },
  { keys: ["pontianak", "pnk"], lat: -0.0263, lng: 109.3425 },
  { keys: ["balikpapan", "bpn"], lat: -1.2379, lng: 116.8529 },
  { keys: ["samarinda", "smd"], lat: -0.5022, lng: 117.1536 },
  { keys: ["makassar", "mks"], lat: -5.1477, lng: 119.4327 },
  { keys: ["manado", "mdo"], lat: 1.4748, lng: 124.8421 },
  { keys: ["denpasar", "bali", "dps"], lat: -8.6705, lng: 115.2126 },
  { keys: ["jayapura"], lat: -2.5337, lng: 140.7181 },
  { keys: ["ambon"], lat: -3.6954, lng: 128.1814 },
];

const TILE_LAYERS: Record<
  MapStyleKey,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  street: {
    label: "Peta Jalan",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
  light: {
    label: "Terang",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
  },
  satellite: {
    label: "Satelit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
};

const INDONESIA_CENTER: [number, number] = [-2.5, 118.0];
const INDONESIA_DEFAULT_ZOOM = 5;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveLatLng(
  s: Site,
  index: number
): { lat: number; lng: number; hasExactCoords: boolean } {
  if (
    typeof s.latitude === "number" &&
    typeof s.longitude === "number" &&
    !Number.isNaN(s.latitude) &&
    !Number.isNaN(s.longitude) &&
    !(s.latitude === 0 && s.longitude === 0) &&
    s.latitude >= -90 &&
    s.latitude <= 90 &&
    s.longitude >= -180 &&
    s.longitude <= 180
  ) {
    return { lat: s.latitude, lng: s.longitude, hasExactCoords: true };
  }

  const searchKey = `${s.slug} ${s.name}`.toLowerCase().replace(/[^a-z]/g, "");
  for (const preset of CITY_LATLNG_PRESETS) {
    if (preset.keys.some((k) => searchKey.includes(k))) {
      return { lat: preset.lat, lng: preset.lng, hasExactCoords: false };
    }
  }

  return {
    lat: -6.2 - (index % 5) * 0.4,
    lng: 106.8 + ((index * 3.2) % 25),
    hasExactCoords: false,
  };
}

function getPinHexColor(site: SiteWithLocation): string {
  if (!site.is_active) return "#737373";
  if (site.devicesCount === 0) return "#0284c7";
  if (site.onlineCount === 0) return "#e11d48";
  if (site.onlineCount < site.devicesCount) return "#f59e0b";
  return "#10b981";
}

export function SiteMapView({
  sites = [],
  devices = [],
  deviceStatuses,
}: {
  sites: Site[];
  devices?: Device[];
  deviceStatuses?: Record<string, DeviceStatusItem>;
}) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    sites[0]?.id || null
  );
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("street");
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const mapInstanceRef = useRef<LeafletNS.Map | null>(null);
  const tileLayerRef = useRef<LeafletNS.TileLayer | null>(null);
  const markerGroupRef = useRef<LeafletNS.LayerGroup | null>(null);
  const initialBoundsDoneRef = useRef(false);

  const sitesWithCoords: SiteWithLocation[] = useMemo(
    () =>
      sites.map((s, index) => {
        const coords = resolveLatLng(s, index);
        const siteDevices = devices.filter((d) => d.site_id === s.id);
        const onlineDevices = siteDevices.filter((d) => {
          if (!d.is_active) return false;
          const st = deviceStatuses?.[d.device_key];
          return st?.status === "online";
        });

        return {
          ...s,
          lat: coords.lat,
          lng: coords.lng,
          hasExactCoords: coords.hasExactCoords,
          devicesCount: siteDevices.length,
          onlineCount: onlineDevices.length,
        };
      }),
    [sites, devices, deviceStatuses]
  );

  const activeSite =
    sitesWithCoords.find((s) => s.id === selectedSiteId) || sitesWithCoords[0];
  const activeCount = sites.filter((s) => s.is_active).length;

  // 1. Initialize Leaflet map instance (client-side only)
  useEffect(() => {
    let cancelled = false;
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;

      leafletRef.current = L;
      const startCenter: [number, number] = activeSite
        ? [activeSite.lat, activeSite.lng]
        : INDONESIA_CENTER;
      const startZoom = activeSite && sitesWithCoords.length === 1 ? 11 : INDONESIA_DEFAULT_ZOOM;

      const map = L.map(mapContainerRef.current, {
        center: startCenter,
        zoom: startZoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      const cfg = TILE_LAYERS[mapStyle];
      const tileLayer = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
      }).addTo(map);

      const markerGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      tileLayerRef.current = tileLayer;
      markerGroupRef.current = markerGroup;
      initialBoundsDoneRef.current = true;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markerGroupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Switch base tile layer when mapStyle changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const cfg = TILE_LAYERS[mapStyle];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
  }, [mapStyle, mapReady]);

  // 3. Render site markers cleanly whenever sites, statuses, or active selection changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const group = markerGroupRef.current;
    if (!L || !map || !group) return;

    group.clearLayers();

    sitesWithCoords.forEach((site) => {
      const isSelected = site.id === activeSite?.id;
      const color = getPinHexColor(site);
      const safeName = escapeHtml(site.name);
      const safeType = site.site_type ? escapeHtml(site.site_type) : "";

      const iconHtml = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
          ${
            isSelected
              ? `<span style="position:absolute;width:28px;height:28px;border-radius:9999px;background:${color};opacity:0.35;animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>`
              : ""
          }
          <span style="position:relative;width:${isSelected ? 18 : 14}px;height:${isSelected ? 18 : 14}px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(15,23,42,0.45);display:block;"></span>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([site.lat, site.lng], { icon });
      marker.on("click", () => {
        setSelectedSiteId(site.id);
      });

      const tooltipHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.3;">
          <div style="font-weight:700;font-size:12px;color:#0f172a;display:flex;align-items:center;gap:4px;">
            <span>${safeName}</span>
            ${
              safeType
                ? `<span style="font-size:9px;background:#e0f2fe;color:#0369a1;padding:1px 4px;border-radius:4px;">${safeType}</span>`
                : ""
            }
          </div>
          <div style="font-size:11px;color:#475569;">
            ${site.devicesCount} devices (${site.onlineCount} online / ${Math.max(0, site.devicesCount - site.onlineCount)} offline)
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -10],
        permanent: isSelected,
        opacity: 0.96,
      });

      marker.addTo(group);
    });
  }, [sitesWithCoords, activeSite?.id, mapReady]);

  const handleFocusSite = () => {
    const map = mapInstanceRef.current;
    if (!map || !activeSite) return;
    map.flyTo([activeSite.lat, activeSite.lng], 13, { duration: 0.7 });
  };

  const handleResetIndonesia = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo(INDONESIA_CENTER, INDONESIA_DEFAULT_ZOOM, { duration: 0.7 });
  };

  return (
    <Card className="border border-neutral-200 dark:border-slate-700 shadow-none overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-neutral-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Factory className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Peta Sebaran Multi-Site Operasional
          </CardTitle>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500 font-medium">
            Total {sites.length} Site ({activeCount} Aktif)
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-4 min-h-90">
          {/* Interactive Real Map (Leaflet + OpenStreetMap / Esri Satellite) */}
          <div className="lg:col-span-3 relative flex flex-col justify-between bg-sky-50 dark:bg-slate-900">
            {/* Map Controls Overlay */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-neutral-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleFocusSite}
                  disabled={!activeSite}
                  className="h-7 px-2.5 text-[11px] gap-1"
                >
                  <Crosshair className="size-3 text-primary" />
                  Fokus Site
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResetIndonesia}
                  className="h-7 px-2.5 text-[11px] gap-1"
                >
                  <Globe className="size-3 text-sky-600" />
                  Reset Indonesia
                </Button>
              </div>

              <div className="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-slate-700 p-0.5 bg-neutral-100/80 dark:bg-slate-800/80">
                <Layers className="size-3 text-neutral-500 ml-1.5 mr-0.5" />
                {(Object.keys(TILE_LAYERS) as MapStyleKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMapStyle(key)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                      mapStyle === key
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {TILE_LAYERS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leaflet Container (isolated stacking context so dropdowns above never clip behind map) */}
            <div className="relative w-full h-80 isolate z-0">
              <div ref={mapContainerRef} className="w-full h-full z-0" />
            </div>

            {/* Map Legend */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-white/95 dark:bg-slate-900 border-t border-neutral-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-medium">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Semua Online
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-500 inline-block" /> Sebagian Online
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-rose-600 inline-block" /> Semua Offline
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-sky-600 inline-block" /> Belum Ada Device
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-neutral-500 inline-block" /> Nonaktif
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Scroll untuk zoom · Klik pin untuk rincian
              </span>
            </div>
          </div>

          {/* Active Site Sidebar Detail */}
          <div className="lg:col-span-1 p-4 bg-slate-50 dark:bg-slate-800/40 border-t lg:border-t-0 lg:border-l border-neutral-200 dark:border-slate-800 flex flex-col justify-between">
            {activeSite ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                      Site Terpilih
                    </span>
                    <h5 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {activeSite.name}
                    </h5>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      activeSite.is_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400"
                    )}
                  >
                    {activeSite.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs pt-1">
                  <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <Server className="size-3.5 text-neutral-400" />
                      Total Device:
                    </span>
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {activeSite.devicesCount} unit
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <Signal
                        className={cn(
                          "size-3.5",
                          activeSite.onlineCount > 0 ? "text-emerald-500" : "text-rose-500"
                        )}
                      />
                      Status Koneksi:
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        activeSite.onlineCount > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {activeSite.onlineCount} Online / {activeSite.devicesCount - activeSite.onlineCount} Offline
                    </span>
                  </div>

                  {/* Technical & SPS Specs (If Available) */}
                  {activeSite.site_type && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <Zap className="size-3.5 text-amber-500" />
                        Tipe Konfigurasi:
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {activeSite.site_type}
                      </span>
                    </div>
                  )}

                  {activeSite.pv_capacity_kwp != null && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <Zap className="size-3.5 text-amber-500" />
                        Kapasitas PV:
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {activeSite.pv_capacity_kwp} kWp
                      </span>
                    </div>
                  )}

                  {activeSite.tower_type && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <Radio className="size-3.5 text-sky-500" />
                        Tipe Menara:
                      </span>
                      <span className="font-medium text-neutral-900 dark:text-white truncate max-w-30">
                        {activeSite.tower_type}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-rose-500" />
                      Koordinat:
                    </span>
                    <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                      {activeSite.lat.toFixed(4)}, {activeSite.lng.toFixed(4)}
                      {!activeSite.hasExactCoords && (
                        <span className="text-[9px] text-neutral-400 ml-1">(kota)</span>
                      )}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-400 pt-1">
                    Slug ID: <code className="text-neutral-600 dark:text-neutral-300">{activeSite.slug}</code>
                  </div>
                </div>

                <div className="pt-3">
                  <Button asChild size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5">
                    <Link href={`/devices?site=${activeSite.id}`}>
                      <span>Lihat Perangkat Site</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 text-center py-8">
                Pilih site pada peta untuk melihat detail.
              </p>
            )}

            {/* Mini Site Switcher List */}
            <div className="pt-4 border-t border-neutral-200 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
                Daftar Site ({sites.length})
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {sitesWithCoords.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSiteId(s.id);
                      mapInstanceRef.current?.flyTo([s.lat, s.lng], 12, { duration: 0.6 });
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1 rounded text-xs truncate flex items-center justify-between transition-colors",
                      s.id === activeSite?.id
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-neutral-100 dark:hover:bg-slate-700/50 text-neutral-600 dark:text-neutral-400"
                    )}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-[10px] text-neutral-400 shrink-0 ml-1">{s.devicesCount} dev</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SiteMapView;
