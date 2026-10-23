"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Device, Site } from "@/lib/types";
import { ExternalLink, Factory, MapPin, Server, Signal } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SiteWithLocation extends Site {
  x: number; // percentage in SVG coordinate (0 - 100)
  y: number; // percentage in SVG coordinate (0 - 100)
  devicesCount: number;
  onlineCount: number;
}

// Preset coordinate mapping for standard Indonesian industrial cities/regions
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

export function SiteMapView({
  sites = [],
  devices = [],
}: {
  sites: Site[];
  devices?: Device[];
}) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    sites[0]?.id || null
  );

  // Map sites with coordinates and device counts
  const sitesWithCoords: SiteWithLocation[] = sites.map((s, index) => {
    const slugKey = s.slug.toLowerCase().replace(/[^a-z]/g, "");
    const preset = Object.entries(LOCATION_PRESETS).find(([k]) =>
      slugKey.includes(k)
    );

    // Fallback pseudo-random spread across archipelago coordinates
    const fallbackX = 20 + ((index * 13) % 65);
    const fallbackY = 40 + ((index * 9) % 35);

    const siteDevices = devices.filter((d) => d.site_id === s.id);
    const onlineDevices = siteDevices.filter((d) => d.is_active);

    return {
      ...s,
      x: preset ? preset[1].x : fallbackX,
      y: preset ? preset[1].y : fallbackY,
      devicesCount: siteDevices.length,
      onlineCount: onlineDevices.length,
    };
  });

  const activeSite = sitesWithCoords.find((s) => s.id === selectedSiteId) || sitesWithCoords[0];

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
            Total {sites.length} Site Aktif
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-4 min-h-85">
          {/* Map Interactive Canvas */}
          <div className="lg:col-span-3 relative bg-slate-900 overflow-hidden flex items-center justify-center p-4">
            {/* Background Grid Accent */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  "radial-gradient(#38bdf8 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            {/* Stylized Indonesia Map SVG Silhouette */}
            <svg
              viewBox="0 0 1000 450"
              className="w-full h-auto max-h-75 text-slate-800 fill-current opacity-70 select-none"
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
              const isSelected = site.id === selectedSiteId;
              const hasDevices = site.devicesCount > 0;

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
                      <span className="absolute size-9 rounded-full bg-primary/30 animate-ping" />
                    )}
                    <span
                      className={cn(
                        "size-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg transition-transform group-hover:scale-125",
                        isSelected
                          ? "bg-primary text-white ring-4 ring-primary/20 scale-110"
                          : hasDevices
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-600 text-slate-200"
                      )}
                    >
                      <MapPin className="size-3" />
                    </span>
                  </div>

                  {/* Tooltip on pin */}
                  <div
                    className={cn(
                      "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-slate-950/90 text-white text-[11px] font-medium whitespace-nowrap shadow-md pointer-events-none transition-all",
                      isSelected ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-95"
                    )}
                  >
                    {site.name}
                  </div>
                </div>
              );
            })}
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
                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    Aktif
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
                      <Signal className="size-3.5 text-emerald-500" />
                      Status Koneksi:
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {activeSite.onlineCount} Online
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 pt-1">
                    Slug ID: <code className="text-neutral-600 dark:text-neutral-300">{activeSite.slug}</code>
                  </div>
                </div>

                <div className="pt-3">
                  <Button asChild size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5">
                    <Link href={`/devices`}>
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
                Daftar Site
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {sitesWithCoords.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSiteId(s.id)}
                    className={cn(
                      "w-full text-left px-2 py-1 rounded text-xs truncate flex items-center justify-between transition-colors",
                      s.id === selectedSiteId
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-neutral-100 dark:hover:bg-slate-700/50 text-neutral-600 dark:text-neutral-400"
                    )}
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] text-neutral-400">{s.devicesCount} dev</span>
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
