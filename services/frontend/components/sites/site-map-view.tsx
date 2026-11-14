"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Device, DeviceStatusItem, Site } from "@/lib/types";
import { ExternalLink, Factory, MapPin, Radio, Server, Signal, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SiteWithLocation extends Site {
  x: number; // percentage in SVG coordinate (0 - 100)
  y: number; // percentage in SVG coordinate (0 - 100)
  devicesCount: number;
  onlineCount: number;
}

// Preset coordinate mapping for standard Indonesian industrial cities/regions (in SVG %)
const LOCATION_PRESETS: Record<string, { x: number; y: number }> = {
  jakarta: { x: 26, y: 68 },
  bandung: { x: 28, y: 72 },
  semarang: { x: 34, y: 72 },
  surabaya: { x: 40, y: 73 },
  medan: { x: 14, y: 32 },
  batam: { x: 22, y: 44 },
  pekanbaru: { x: 18, y: 46 },
  palembang: { x: 23, y: 58 },
  pontianak: { x: 33, y: 50 },
  balikpapan: { x: 47, y: 53 },
  samarinda: { x: 48, y: 50 },
  makassar: { x: 55, y: 66 },
  manado: { x: 67, y: 38 },
  denpasar: { x: 44, y: 76 },
};

function calculateCoordinates(s: Site, index: number): { x: number; y: number } {
  // 1. Real GPS coordinates (WGS84) within Indonesian archipelago bounds
  // Longitude ~94.5°E (Sabang) to ~141.5°E (Merauke)
  // Latitude ~6.5°N (Miangas) to ~-11.5°S (Rote)
  if (
    typeof s.latitude === "number" &&
    typeof s.longitude === "number" &&
    !isNaN(s.latitude) &&
    !isNaN(s.longitude) &&
    s.latitude >= -11.5 &&
    s.latitude <= 6.5 &&
    s.longitude >= 94.5 &&
    s.longitude <= 141.5
  ) {
    const normX = (s.longitude - 94.5) / (141.5 - 94.5);
    const normY = (6.5 - s.latitude) / (6.5 - -11.5);
    return {
      x: Math.round((normX * 84 + 8) * 10) / 10, // keep within 8% to 92% of SVG width
      y: Math.round((normY * 74 + 13) * 10) / 10, // keep within 13% to 87% of SVG height
    };
  }

  // 2. Preset match based on slug or name
  const searchKey = `${s.slug} ${s.name}`.toLowerCase().replace(/[^a-z]/g, "");
  const preset = Object.entries(LOCATION_PRESETS).find(([k]) => searchKey.includes(k));
  if (preset) {
    return preset[1];
  }

  // 3. Fallback pseudo-random spread across archipelago coordinates
  const fallbackX = 18 + ((index * 13) % 68);
  const fallbackY = 35 + ((index * 9) % 40);
  return { x: fallbackX, y: fallbackY };
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
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites[0]?.id || null);

  // Map sites with coordinates and live device connection counts
  const sitesWithCoords: SiteWithLocation[] = sites.map((s, index) => {
    const coords = calculateCoordinates(s, index);
    const siteDevices = devices.filter((d) => d.site_id === s.id);
    const onlineDevices = siteDevices.filter((d) => {
      if (!d.is_active) return false;
      const st = deviceStatuses?.[d.device_key];
      return st?.status === "online";
    });

    return {
      ...s,
      x: coords.x,
      y: coords.y,
      devicesCount: siteDevices.length,
      onlineCount: onlineDevices.length,
    };
  });

  const activeSite = sitesWithCoords.find((s) => s.id === selectedSiteId) || sitesWithCoords[0];
  const activeCount = sites.filter((s) => s.is_active).length;

  return (
    <Card className="border border-neutral-200 dark:border-slate-700 shadow-none overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-neutral-100 dark:border-slate-800 flex flex-row items-center justify-between">
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
        <div className="grid grid-cols-1 lg:grid-cols-4 min-h-85">
          {/* Map Interactive Canvas */}
          <div className="lg:col-span-3 relative bg-linear-to-br from-sky-50 via-blue-50/80 to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden flex flex-col justify-between p-4">
            {/* Background Grid Accent */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(#0284c7 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            {/* Stylized Indonesia Map SVG Silhouette */}
            <div className="relative w-full flex items-center justify-center py-2">
              <svg
                viewBox="0 0 1000 450"
                className="w-full h-auto max-h-75 text-emerald-200 dark:text-slate-700 fill-current stroke-emerald-500/50 dark:stroke-slate-500 select-none"
                strokeWidth={2}
              >
                {/* Sumatra */}
                <path d="M70,80 L220,240 L190,280 L160,260 L60,110 Z" />
                {/* Java */}
                <path d="M220,310 L450,330 L440,350 L210,330 Z" />
                {/* Kalimantan */}
                <path d="M280,140 L450,150 L460,260 L320,270 L270,210 Z" />
                {/* Sulawesi */}
                <path d="M490,160 L570,165 L560,200 L530,220 L580,290 L550,310 L510,240 Z" />
                {/* Papua */}
                <path d="M680,200 L880,210 L900,320 L760,330 L720,260 Z" />
              </svg>

              {/* Pins for Each Site */}
              {sitesWithCoords.map((site) => {
                const isSelected = site.id === activeSite?.id;
                const hasDevices = site.devicesCount > 0;

                // Color code pin status
                let pinColorClass = "bg-slate-600 text-slate-200";
                if (!site.is_active) {
                  pinColorClass = "bg-neutral-500 text-neutral-200 border border-neutral-400";
                } else if (!hasDevices) {
                  pinColorClass = "bg-sky-600 text-white";
                } else if (site.onlineCount === 0) {
                  pinColorClass = "bg-rose-600 text-white";
                } else if (site.onlineCount < site.devicesCount) {
                  pinColorClass = "bg-amber-500 text-white";
                } else {
                  pinColorClass = "bg-emerald-500 text-white";
                }

                return (
                  <div
                    key={site.id}
                    style={{
                      left: `${site.x}%`,
                      top: `${site.y}%`,
                    }}
                    onClick={() => setSelectedSiteId(site.id)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
                  >
                    <div className="relative flex items-center justify-center">
                      {/* Radar Pulse on active site */}
                      {isSelected && (
                        <span className="absolute size-9 rounded-full bg-primary/40 animate-ping" />
                      )}
                      <span
                        className={cn(
                          "size-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg transition-transform group-hover:scale-125",
                          isSelected
                            ? "bg-primary text-white ring-4 ring-primary/30 scale-110"
                            : pinColorClass
                        )}
                      >
                        <MapPin className="size-3" />
                      </span>
                    </div>

                    {/* Tooltip on pin */}
                    <div
                      className={cn(
                        "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-md bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white text-[11px] font-medium whitespace-nowrap shadow-lg pointer-events-none transition-all z-30 border border-slate-200 dark:border-slate-700",
                        isSelected ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-95"
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>{site.name}</span>
                        {site.site_type && (
                          <span className="text-[9px] bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 px-1 py-0.5 rounded">
                            {site.site_type}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-300">
                        {site.devicesCount} devices ({site.onlineCount} online)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Map Legend */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-200/80 dark:border-slate-800/80 text-[10px] text-slate-700 dark:text-slate-300 font-medium">
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
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Klik pin untuk rincian</span>
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
                      <Signal className={cn("size-3.5", activeSite.onlineCount > 0 ? "text-emerald-500" : "text-rose-500")} />
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

                  {activeSite.latitude != null && activeSite.longitude != null && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-rose-500" />
                        Koordinat:
                      </span>
                      <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                        {activeSite.latitude.toFixed(4)}, {activeSite.longitude.toFixed(4)}
                      </span>
                    </div>
                  )}

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
                    onClick={() => setSelectedSiteId(s.id)}
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
