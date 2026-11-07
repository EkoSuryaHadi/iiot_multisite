"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { analyticsApi, ApiRequestError } from "@/lib/api-client";
import type { Device, Site, TelemetryPoint } from "@/lib/types";
import toast from "react-hot-toast";

interface ExportTelemetryDialogProps {
  devices: Device[];
  sites: Site[];
  initialDeviceId?: string;
  initialMetric?: string;
  initialInterval?: "raw" | "1m" | "1h";
  initialStart?: string;
  initialEnd?: string;
  currentPoints?: TelemetryPoint[];
}

export function ExportTelemetryDialog({
  devices = [],
  sites = [],
  initialDeviceId,
  initialMetric = "temp",
  initialInterval = "raw",
  initialStart,
  initialEnd,
  currentPoints,
}: ExportTelemetryDialogProps) {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState(initialDeviceId || devices[0]?.id || "");
  const [metricName, setMetricName] = useState(initialMetric);
  const [interval, setInterval] = useState<"raw" | "1m" | "1h">(initialInterval);
  const [limit, setLimit] = useState(1000);
  const [exporting, setExporting] = useState(false);

  // Time default: 24 hours back
  const [start, setStart] = useState(() => {
    if (initialStart) return initialStart;
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [end, setEnd] = useState(() => {
    if (initialEnd) return initialEnd;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const generateAndDownloadCsv = (
    points: TelemetryPoint[],
    deviceKey: string,
    siteSlug: string,
    metric: string,
    intvl: string
  ) => {
    const headers = [
      "timestamp_iso",
      "timestamp_local",
      "device_key",
      "site_slug",
      "metric_name",
      "interval",
      "value",
      "avg",
      "min",
      "max",
      "sample_count",
    ];

    const rows = points.map((p) => {
      const d = new Date(p.ts);
      const iso = d.toISOString();
      const local = d.toLocaleString();
      const val = p.value !== undefined && p.value !== null ? p.value : "";
      const avg = p.avg !== undefined && p.avg !== null ? p.avg.toFixed(3) : "";
      const min = p.min !== undefined && p.min !== null ? p.min.toFixed(3) : "";
      const max = p.max !== undefined && p.max !== null ? p.max.toFixed(3) : "";
      const count = p.count !== undefined && p.count !== null ? p.count : 1;

      return [
        `"${iso}"`,
        `"${local.replace(/"/g, '""')}"`,
        `"${deviceKey}"`,
        `"${siteSlug}"`,
        `"${metric}"`,
        `"${intvl}"`,
        val,
        avg,
        min,
        max,
        count,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `telemetry_${deviceKey || "export"}_${metric}_${timestamp}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) {
      toast.error("Pilih device telemetri terlebih dahulu");
      return;
    }
    const site = sites.find((s) => s.id === dev.site_id);

    setExporting(true);
    try {
      const res = await analyticsApi.getTelemetry({
        device_key: dev.device_key,
        site_slug: site?.slug,
        metric_name: metricName,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        interval,
        limit,
        offset: 0,
      });

      if (!res.points || res.points.length === 0) {
        toast.error("Tidak ada data telemetri yang ditemukan untuk rentang waktu ini");
        return;
      }

      generateAndDownloadCsv(
        res.points,
        dev.device_key,
        site?.slug || "default",
        metricName,
        interval
      );

      toast.success(`Berhasil mengunduh ${res.points.length} baris telemetri (.csv)`);
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof ApiRequestError ? err.message : "Gagal mengekspor data telemetri"
      );
    } finally {
      setExporting(false);
    }
  };

  // Quick export helper for current active query
  const handleQuickExportCurrent = () => {
    if (!currentPoints || currentPoints.length === 0) {
      toast.error("Tidak ada data tabel untuk diekspor");
      return;
    }
    const dev = devices.find((d) => d.id === (initialDeviceId || deviceId));
    const site = sites.find((s) => s.id === dev?.site_id);
    generateAndDownloadCsv(
      currentPoints,
      dev?.device_key || "active",
      site?.slug || "site",
      initialMetric,
      initialInterval
    );
    toast.success(`Berhasil mengunduh ${currentPoints.length} baris telemetri (.csv)`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        {currentPoints && currentPoints.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleQuickExportCurrent}
            className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Unduh data tabel saat ini langsung ke CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export Tabel (.csv)
          </Button>
        )}
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs border-neutral-300 dark:border-slate-700 hover:bg-neutral-100 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Bulk Export CSV
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Export Telemetri ke CSV
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Ekspor data timeseries ClickHouse ke format spreadsheet RFC 4180.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleExport} className="space-y-4 text-sm mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Device Sumber</Label>
            <Select
              value={deviceId}
              onValueChange={(val) => val && setDeviceId(val)}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Pilih device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name} ({d.device_key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Metrik</Label>
              <Input
                value={metricName}
                onChange={(e) => setMetricName(e.target.value)}
                placeholder="temp / voltage / pressure"
                required
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Agregasi Interval</Label>
              <Select
                value={interval}
                onValueChange={(v) => setInterval(v as "raw" | "1m" | "1h")}
              >
                <SelectTrigger className="w-full text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw" className="text-xs">
                    Raw Data (Semua Sampel)
                  </SelectItem>
                  <SelectItem value="1m" className="text-xs">
                    1 Menit (Avg, Min, Max)
                  </SelectItem>
                  <SelectItem value="1h" className="text-xs">
                    1 Jam (Avg, Min, Max)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Waktu Mulai</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Waktu Akhir</Label>
              <Input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Maksimal Baris</Label>
            <Select
              value={String(limit)}
              onValueChange={(v) => setLimit(Number(v))}
            >
              <SelectTrigger className="w-full text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500" className="text-xs">500 baris</SelectItem>
                <SelectItem value="1000" className="text-xs">1.000 baris</SelectItem>
                <SelectItem value="2500" className="text-xs">2.500 baris</SelectItem>
                <SelectItem value="5000" className="text-xs">5.000 baris</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={exporting || !deviceId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Mengunduh...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download CSV
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
