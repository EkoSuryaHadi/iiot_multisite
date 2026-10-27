"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { TelemetryPoint } from "@/lib/types";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Gauge,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface TelemetryKpiCardsProps {
  points: TelemetryPoint[];
  metricName: string;
  unit: string;
  interval: "raw" | "1m" | "1h";
  isDeviceOnline?: boolean;
}

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 5) return "Baru saja";
    if (diffSec < 60) return `${diffSec} dtk lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
  } catch {
    return dateString;
  }
}

function formatTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function TelemetryKpiCards({
  points,
  unit,
  isDeviceOnline,
}: TelemetryKpiCardsProps) {
  if (!points || points.length === 0) return null;

  // Points are chronologically ordered (oldest to newest)
  const latestPoint = points[points.length - 1];
  const prevPoint = points.length > 1 ? points[points.length - 2] : null;

  const latestVal = latestPoint.value ?? latestPoint.avg ?? 0;
  const prevVal = prevPoint ? (prevPoint.value ?? prevPoint.avg ?? latestVal) : latestVal;
  const delta = latestVal - prevVal;

  // Extract all values
  const values = points.map((p) => p.value ?? p.avg ?? 0);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const avgVal = values.reduce((acc, curr) => acc + curr, 0) / values.length;

  const minPoint = points.find((p) => (p.value ?? p.avg ?? 0) === minVal);
  const maxPoint = points.find((p) => (p.value ?? p.avg ?? 0) === maxVal);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
      {/* 1. Nilai Terkini */}
      <Card className="border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-blue-500" />
              Nilai Terkini
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {formatRelativeTime(latestPoint.ts)}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-mono">
              {latestVal.toFixed(2)}
            </span>
            {unit && (
              <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400">
                {unit}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px]">
            {delta > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <ArrowUpRight className="w-3 h-3" /> +{delta.toFixed(2)}
              </span>
            ) : delta < 0 ? (
              <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-medium">
                <ArrowDownRight className="w-3 h-3" /> {delta.toFixed(2)}
              </span>
            ) : (
              <span className="text-neutral-400 font-medium">Stabil (0.00)</span>
            )}
            <span className="text-neutral-400 ml-1">vs data lalu</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Rata-rata */}
      <Card className="border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              Rata-rata (Avg)
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-mono">
              {avgVal.toFixed(2)}
            </span>
            {unit && (
              <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400">
                {unit}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 mt-2 truncate">
            Periode observasi
          </p>
        </CardContent>
      </Card>

      {/* 3. Minimum */}
      <Card className="border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-cyan-500" />
              Terendah (Min)
            </span>
            {minPoint && (
              <span className="text-[10px] font-mono text-neutral-400">
                {formatTime(minPoint.ts)}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold tracking-tight text-cyan-600 dark:text-cyan-400 font-mono">
              {minVal.toFixed(2)}
            </span>
            {unit && (
              <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400">
                {unit}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 mt-2">
            Titik terendah rentang
          </p>
        </CardContent>
      </Card>

      {/* 4. Maksimum */}
      <Card className="border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              Tertinggi (Max)
            </span>
            {maxPoint && (
              <span className="text-[10px] font-mono text-neutral-400">
                {formatTime(maxPoint.ts)}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {maxVal.toFixed(2)}
            </span>
            {unit && (
              <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400">
                {unit}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 mt-2">
            Puncak beban / sensor
          </p>
        </CardContent>
      </Card>

      {/* 5. Total Sampel & Koneksi */}
      <Card className="col-span-2 md:col-span-4 lg:col-span-1 border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              Total Sampel
            </span>
            {isDeviceOnline !== undefined && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  isDeviceOnline
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-neutral-100 text-neutral-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isDeviceOnline ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
                  }`}
                />
                {isDeviceOnline ? "Online" : "Offline"}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-mono">
              {points.length.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-neutral-400">titik</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-2 truncate">
            {formatTime(points[0].ts)} → {formatTime(latestPoint.ts)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
