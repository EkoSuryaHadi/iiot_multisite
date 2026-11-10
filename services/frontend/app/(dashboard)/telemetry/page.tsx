"use client";

import TelemetryChart from "@/app/(dashboard)/telemetry/components/telemetry-chart";
import { TelemetryKpiCards } from "@/app/(dashboard)/telemetry/components/telemetry-kpi-cards";
import { RadialGauge } from "@/components/charts/radial-gauge";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import TenantSelector from "@/components/shared/tenant-selector";
import { ExportTelemetryDialog } from "@/components/telemetry/export-telemetry-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantContext } from "@/contexts/TenantContext";
import { analyticsApi, ApiRequestError, devicesApi, sitesApi } from "@/lib/api-client";
import {
  COMMON_METRICS,
  getMetricConfig,
  TIME_PRESETS,
} from "@/lib/telemetry-constants";
import type { Device, Site, TelemetryResponse } from "@/lib/types";
import {
  Activity,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

function toInputDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function TelemetryPageContent() {
  const { isSuperadmin, selectedTenant } = useTenantContext();
  const searchParams = useSearchParams();
  const deviceParam = searchParams.get("device") || searchParams.get("device_id");
  const siteParam = searchParams.get("site") || searchParams.get("site_id");
  const metricParam = searchParams.get("metric");
  const intervalParam = searchParams.get("interval");

  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, "online" | "offline">>({});
  
  // Selection states
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [deviceId, setDeviceId] = useState<string>("");
  const [metricName, setMetricName] = useState(() => metricParam || "temp");
  const [aggInterval, setAggInterval] = useState<"raw" | "1m" | "1h">(() => {
    if (intervalParam === "1m" || intervalParam === "1h") return intervalParam;
    return "raw";
  });

  // System & Dynamic Metrics states
  const [systemMetrics, setSystemMetrics] = useState<string[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [isCustomMetric, setIsCustomMetric] = useState(false);
  
  // Time states
  const [activePresetMinutes, setActivePresetMinutes] = useState<number | null>(60);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [start, setStart] = useState(() => toInputDateTime(new Date(Date.now() - 60 * 60 * 1000)));
  const [end, setEnd] = useState(() => toInputDateTime(new Date()));

  // Auto-refresh states
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off, 10, 30, 60
  const [isLivePulse, setIsLivePulse] = useState(false);

  // Table & Results
  const [page, setPage] = useState(0);
  const [tableSortDesc, setTableSortDesc] = useState(true);
  const pageSize = 50;

  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [result, setResult] = useState<TelemetryResponse | null>(null);

  // Filter devices by selected site
  const filteredDevices = devices.filter((d) => {
    if (selectedSiteId === "all") return true;
    return d.site_id === selectedSiteId;
  });

  const selectedDevice = devices.find((d) => d.id === deviceId);
  const selectedSite = sites.find((s) => s.id === selectedDevice?.site_id);
  const isSelectedDeviceOnline = selectedDevice
    ? deviceStatuses[selectedDevice.device_key] === "online"
    : undefined;

  const metricConfig = getMetricConfig(metricName);

  // Load devices, sites, and statuses
  const loadMetadata = useCallback(async () => {
    if (isSuperadmin && !selectedTenant) {
      setDevices([]);
      setSites([]);
      setDeviceStatuses({});
      setResult(null);
      return;
    }
    try {
      const [allDevices, allSites, statusRes] = await Promise.all([
        devicesApi.list(),
        sitesApi.list(),
        analyticsApi.getDevicesStatus({
          tenant_slug: isSuperadmin ? selectedTenant?.slug : undefined,
        }).catch(() => null),
      ]);

      const scopedDevices =
        isSuperadmin && selectedTenant
          ? allDevices.filter((d) => d.tenant_id === selectedTenant.id)
          : allDevices;
      const scopedSites =
        isSuperadmin && selectedTenant
          ? allSites.filter((s) => s.tenant_id === selectedTenant.id)
          : allSites;

      setDevices(scopedDevices);
      setSites(scopedSites);

      if (statusRes?.devices) {
        const statusMap: Record<string, "online" | "offline"> = {};
        statusRes.devices.forEach((d) => {
          statusMap[d.device_key] = d.status;
        });
        setDeviceStatuses(statusMap);
      }

      if (siteParam) {
        const matchedSite = scopedSites.find(
          (s) => s.id === siteParam || s.slug === siteParam
        );
        if (matchedSite) {
          setSelectedSiteId(matchedSite.id);
        }
      }

      setDeviceId((prev) => {
        if (deviceParam) {
          const matched = scopedDevices.find(
            (d) => d.id === deviceParam || d.device_key === deviceParam
          );
          if (matched) return matched.id;
        }
        if (prev && scopedDevices.some((d) => d.id === prev)) return prev;
        return scopedDevices[0]?.id || "";
      });
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memuat daftar perangkat");
    }
  }, [isSuperadmin, selectedTenant, deviceParam, siteParam]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Main search function
  const fetchTelemetry = useCallback(
    async (targetOffset = 0, isBackground = false) => {
      if (!selectedDevice) return;

      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        if (!isBackground) toast.error("Format tanggal dan waktu tidak valid");
        return;
      }
      if (endDate <= startDate) {
        if (!isBackground) toast.error("Waktu selesai (end) harus lebih besar dari waktu mulai (start)");
        return;
      }

      if (!isBackground) setLoading(true);
      setPage(targetOffset / pageSize);

      try {
        const res = await analyticsApi.getTelemetry({
          device_key: selectedDevice.device_key,
          site_slug: selectedSite?.slug,
          tenant_slug: isSuperadmin ? selectedTenant?.slug : undefined,
          metric_name: metricName,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          interval: aggInterval,
          limit: pageSize,
          offset: targetOffset,
        });
        setResult(res);
        if (isBackground) {
          setIsLivePulse(true);
          setTimeout(() => setIsLivePulse(false), 1000);
        }
      } catch (error) {
        if (!isBackground) {
          toast.error(error instanceof ApiRequestError ? error.message : "Gagal memuat data telemetri");
          setResult(null);
        }
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [selectedDevice, selectedSite, isSuperadmin, selectedTenant, metricName, start, end, aggInterval]
  );

  // Auto-load on initial device load
  const initialFetchDoneRef = useRef(false);
  useEffect(() => {
    if (selectedDevice && !initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      fetchTelemetry(0).then(() => setInitialLoaded(true));
    }
  }, [selectedDevice, fetchTelemetry]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;

    const timer = window.setInterval(() => {
      // Update end time to current for live view if preset was used
      if (activePresetMinutes) {
        const now = new Date();
        const past = new Date(now.getTime() - activePresetMinutes * 60 * 1000);
        setStart(toInputDateTime(past));
        setEnd(toInputDateTime(now));
      }
      fetchTelemetry(page * pageSize, true);
    }, autoRefreshInterval * 1000);

    return () => window.clearInterval(timer);
  }, [autoRefreshInterval, activePresetMinutes, page, fetchTelemetry]);

  // Handle Quick Time Presets
  const handleApplyPreset = (minutes: number, recInterval: "raw" | "1m" | "1h") => {
    const now = new Date();
    const past = new Date(now.getTime() - minutes * 60 * 1000);
    setStart(toInputDateTime(past));
    setEnd(toInputDateTime(now));
    setAggInterval(recInterval);
    setActivePresetMinutes(minutes);
    setShowCustomRange(false);
  };

  // Auto-fetch metrics available in the system for selected device/site
  useEffect(() => {
    let isMounted = true;
    async function fetchDeviceMetrics() {
      if (!selectedDevice) {
        setSystemMetrics([]);
        return;
      }
      setLoadingMetrics(true);
      try {
        const metrics = await analyticsApi.getMetrics({
          device_key: selectedDevice.device_key,
          site_slug: selectedSite?.slug,
          tenant_slug: isSuperadmin ? selectedTenant?.slug : undefined,
        });
        if (isMounted) {
          const list = metrics || [];
          setSystemMetrics(list);
          if (list.length > 0) {
            setMetricName((prev) => {
              if (list.includes(prev)) return prev;
              return list[0];
            });
          }
        }
      } catch (err) {
        console.error("Gagal memuat metrik sistem:", err);
      } finally {
        if (isMounted) setLoadingMetrics(false);
      }
    }
    fetchDeviceMetrics();
    return () => {
      isMounted = false;
    };
  }, [selectedDevice?.device_key, selectedSite?.slug, isSuperadmin, selectedTenant?.slug]);

  // Quick Metric Selection
  const handleSelectMetric = (metricKey: string) => {
    setMetricName(metricKey);
    setIsCustomMetric(false);
  };

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <DashboardBreadcrumb title="TELEMETRY" text="Telemetry Realtime & Analytics" />
          <p className="text-xs text-neutral-500 mt-1">
            Visualisasi timeseries, statistik sensor, dan audit log performa perangkat industri.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <TenantSelector />

          {/* Auto Refresh Toggle */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-lg p-1 text-xs">
            <span className="flex items-center gap-1.5 px-2 text-neutral-500 font-medium">
              <Radio
                className={`w-3 h-3 ${
                  autoRefreshInterval > 0
                    ? isLivePulse
                      ? "text-emerald-500 animate-ping"
                      : "text-emerald-500 animate-pulse"
                    : "text-neutral-400"
                }`}
              />
              Live
            </span>
            <Select
              value={String(autoRefreshInterval)}
              onValueChange={(val) => setAutoRefreshInterval(Number(val))}
            >
              <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none w-22 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="5">5 dtk</SelectItem>
                <SelectItem value="15">15 dtk</SelectItem>
                <SelectItem value="30">30 dtk</SelectItem>
                <SelectItem value="60">1 mnt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ExportTelemetryDialog
            devices={devices}
            sites={sites}
            initialDeviceId={deviceId}
            initialMetric={metricName}
            initialInterval={aggInterval}
            initialStart={start}
            initialEnd={end}
            currentPoints={result?.points}
            availableMetrics={systemMetrics}
          />
        </div>
      </div>

      {/* Banner if no devices */}
      {devices.length === 0 && !loading && (
        <Card className="card mb-6 border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Belum ada perangkat terdaftar pada tenant ini
                </p>
                <p className="text-[11px] text-neutral-500">
                  Daftarkan perangkat dan hubungkan via MQTT untuk mulai melihat data telemetri real-time.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="text-xs h-8">
              <Link href="/devices">Buka Menu Perangkat</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Control & Filter Panel */}
      <Card className="card mb-6 border border-neutral-200 dark:border-slate-800 shadow-xs">
        <CardContent className="p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchTelemetry(0);
            }}
            className="space-y-4"
          >
            {/* Filter Row 1: Site, Device, Metric, Interval */}
            <div className="flex flex-wrap items-end gap-3.5">
              {/* Site Selector */}
              <div className="space-y-1.5 w-full sm:w-50 shrink-0">
                <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-neutral-400" />
                  Site Industri
                </Label>
                <Select
                  value={selectedSiteId}
                  onValueChange={(val) => {
                    setSelectedSiteId(val);
                    // Reset device to first available under that site
                    const devsInSite = devices.filter((d) => val === "all" || d.site_id === val);
                    if (devsInSite.length > 0) {
                      setDeviceId(devsInSite[0].id);
                    } else {
                      setDeviceId("");
                    }
                  }}
                >
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue placeholder="Pilih Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Site ({devices.length} Perangkat)</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({devices.filter((d) => d.site_id === s.id).length} dev)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Device Selector */}
              <div className="space-y-1.5 w-full sm:w-65 shrink-0">
                <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center justify-between">
                  <span>Perangkat IoT</span>
                  {selectedDevice && (
                    <span className="text-[11px] font-mono text-neutral-400 truncate max-w-32.5" title={selectedDevice.device_key}>
                      key: {selectedDevice.device_key}
                    </span>
                  )}
                </Label>
                <Select value={deviceId} onValueChange={(v) => v && setDeviceId(v)}>
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue placeholder="Pilih device">
                      {selectedDevice && (
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              deviceStatuses[selectedDevice.device_key] === "online"
                                ? "bg-emerald-500 shadow-xs shadow-emerald-400"
                                : "bg-neutral-300 dark:bg-neutral-600"
                            }`}
                          />
                          <span className="font-medium truncate">{selectedDevice.name}</span>
                          <span className="text-neutral-400 text-[11px]">
                            ({selectedDevice.device_key})
                          </span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDevices.length === 0 ? (
                      <div className="p-3 text-center text-xs text-neutral-400">
                        Tidak ada perangkat pada site ini
                      </div>
                    ) : (
                      filteredDevices.map((d) => {
                        const devSite = sites.find((s) => s.id === d.site_id);
                        const isOnline = deviceStatuses[d.device_key] === "online";
                        return (
                          <SelectItem key={d.id} value={d.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isOnline ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
                                }`}
                              />
                              <span className="font-medium">{d.name}</span>
                              <span className="text-neutral-400 text-[10px] font-mono">
                                ({d.device_key})
                              </span>
                              {devSite && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1 text-neutral-500 border-neutral-200 ml-auto"
                                >
                                  {devSite.name}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Metric Dropdown Selector / Custom Input */}
              <div className="space-y-1.5 w-full sm:w-57.5 shrink-0">
                <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    Nama Metrik
                  </span>
                  {metricConfig.unit && (
                    <span className="text-[11px] text-blue-500 font-medium">
                      Satuan: {metricConfig.unit}
                    </span>
                  )}
                </Label>
                {!isCustomMetric ? (
                  <Select
                    value={metricName}
                    onValueChange={(val) => {
                      if (val === "__custom__") {
                        setIsCustomMetric(true);
                        return;
                      }
                      setMetricName(val);
                      setActivePresetMinutes(null);
                    }}
                  >
                    <SelectTrigger className="w-full text-xs h-9">
                      <SelectValue placeholder="Pilih Metrik">
                        <div className="flex items-center justify-between w-full pr-1">
                          <span className="font-mono font-medium truncate">{metricName}</span>
                          {metricConfig.unit && (
                            <span className="text-[11px] text-neutral-400 font-sans ml-1 shrink-0">
                              ({metricConfig.unit})
                            </span>
                          )}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {loadingMetrics ? (
                        <div className="p-2 text-xs text-neutral-400 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Memuat metrik sistem...
                        </div>
                      ) : (
                        <>
                          {systemMetrics.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-between px-2 py-1">
                                <span>Metrik di Sistem</span>
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded font-mono">
                                  {systemMetrics.length}
                                </span>
                              </SelectLabel>
                              {systemMetrics.map((m) => {
                                const cfg = getMetricConfig(m);
                                return (
                                  <SelectItem key={m} value={m} className="text-xs">
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span className="font-mono font-medium">{m}</span>
                                      <span className="text-neutral-400 text-[11px]">
                                        {cfg.name !== m ? cfg.name : ""} {cfg.unit ? `(${cfg.unit})` : ""}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          )}

                          <SelectGroup>
                            <SelectLabel className="text-[11px] text-neutral-500 font-semibold px-2 py-1">
                              {systemMetrics.length > 0 ? "Metrik Standar Lainnya" : "Metrik Standar"}
                            </SelectLabel>
                            {COMMON_METRICS.filter((cm) => !systemMetrics.includes(cm.key)).map((cm) => (
                              <SelectItem key={cm.key} value={cm.key} className="text-xs">
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span className="font-mono">{cm.key}</span>
                                  <span className="text-neutral-400 text-[11px]">
                                    {cm.name} ({cm.unit})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>

                          <SelectGroup>
                            <SelectItem
                              value="__custom__"
                              className="text-xs text-blue-600 dark:text-blue-400 font-medium border-t border-neutral-100 dark:border-slate-800 cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                + Input Metrik Kustom...
                              </span>
                            </SelectItem>
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="relative flex items-center">
                    <Input
                      value={metricName}
                      onChange={(e) => {
                        setMetricName(e.target.value);
                        setActivePresetMinutes(null);
                      }}
                      placeholder="temp / voltage / pressure"
                      required
                      autoFocus
                      className="text-xs h-9 font-mono pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomMetric(false)}
                      title="Kembali ke dropdown"
                      className="absolute right-1 text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 px-1.5 py-1 bg-neutral-100 dark:bg-slate-800 rounded hover:bg-neutral-200"
                    >
                      Pilih ▾
                    </button>
                  </div>
                )}
              </div>

              {/* Interval */}
              <div className="space-y-1.5 w-full sm:w-40 shrink-0">
                <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Agregasi Interval
                </Label>
                <Select
                  value={aggInterval}
                  onValueChange={(v) => setAggInterval(v as "raw" | "1m" | "1h")}
                >
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw" className="text-xs">
                      Raw (Detail)
                    </SelectItem>
                    <SelectItem value="1m" className="text-xs">
                      1 Menit (Avg/Min/Max)
                    </SelectItem>
                    <SelectItem value="1h" className="text-xs">
                      1 Jam (Avg/Min/Max)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Row 2: Metric Quick Chips & Time Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-slate-800">
              {/* Quick Metric Chips */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold text-neutral-400 mr-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Preset Metrik:
                </span>
                {[
                  { key: "temp", label: "Suhu (°C)" },
                  { key: "humidity", label: "Kelembapan (%)" },
                  { key: "voltage", label: "Tegangan (V)" },
                  { key: "current", label: "Arus (A)" },
                  { key: "power", label: "Daya (kW)" },
                  { key: "pressure", label: "Tekanan (bar)" },
                ].map((chip) => {
                  const isActive = metricName.toLowerCase() === chip.key.toLowerCase();
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleSelectMetric(chip.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Time Presets */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold text-neutral-400 mr-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  Rentang Cepat:
                </span>
                {TIME_PRESETS.map((preset) => {
                  const isActive = activePresetMinutes === preset.durationMinutes;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        handleApplyPreset(preset.durationMinutes, preset.recommendedInterval)
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowCustomRange(!showCustomRange)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    showCustomRange
                      ? "bg-neutral-800 text-white dark:bg-slate-700"
                      : "bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-800 text-neutral-700 dark:text-slate-300"
                  }`}
                >
                  Custom
                  {showCustomRange ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Custom Datetime Inputs */}
            {showCustomRange && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-neutral-50 dark:bg-slate-950/60 rounded-lg border border-neutral-200 dark:border-slate-800 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Waktu Mulai (Start)</Label>
                  <Input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      setActivePresetMinutes(null);
                    }}
                    required
                    className="text-xs h-9 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Waktu Selesai (End)</Label>
                  <Input
                    type="datetime-local"
                    value={end}
                    onChange={(e) => {
                      setEnd(e.target.value);
                      setActivePresetMinutes(null);
                    }}
                    required
                    className="text-xs h-9 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Submit Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-neutral-400">
                Menampilkan data rentang:{" "}
                <strong className="text-neutral-700 dark:text-neutral-300">
                  {new Date(start).toLocaleDateString()} {new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </strong>{" "}
                sampai{" "}
                <strong className="text-neutral-700 dark:text-neutral-300">
                  {new Date(end).toLocaleDateString()} {new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchTelemetry(page * pageSize)}
                  disabled={loading || !selectedDevice}
                  className="text-xs h-9"
                  title="Refresh manual"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || !selectedDevice}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-4 flex items-center gap-1.5 shadow-xs"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Tampilkan Telemetri
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Main Visuals & Analytics Section */}
      {result && (
        <>
          {result.points.length === 0 ? (
            <Card className="card mb-6 border border-dashed border-neutral-300 dark:border-slate-800">
              <CardContent className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-slate-800 flex items-center justify-center text-neutral-400 mb-3">
                  <Activity className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Tidak Ada Titik Data Telemetri
                </h4>
                <p className="text-xs text-neutral-500 max-w-md mt-1 mb-4">
                  Perangkat &quot;{selectedDevice?.name}&quot; belum mengirimkan data untuk metrik &quot;{result.metric_name}&quot; pada rentang waktu yang dipilih.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPreset(1440, "1m")}
                    className="text-xs"
                  >
                    Coba 24 Jam Terakhir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectMetric("temp")}
                    className="text-xs"
                  >
                    Reset ke Suhu (&apos;temp&apos;)
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 1. Industrial KPI Cards Summary */}
              <TelemetryKpiCards
                points={result.points}
                metricName={result.metric_name}
                unit={metricConfig.unit}
                interval={result.interval}
                isDeviceOnline={isSelectedDeviceOnline}
              />

              {/* 2. Visual Charts & Gauge */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                {/* Radial Gauge (Current Reading) */}
                <div className="lg:col-span-1">
                  {(() => {
                    const latestPoint = result.points[result.points.length - 1];
                    const latestVal = latestPoint.value ?? latestPoint.avg ?? 0;
                    const vals = result.points.map((p) => p.value ?? p.avg ?? 0);
                    const observedMin = Math.floor(Math.min(...vals));
                    const observedMax = Math.ceil(Math.max(...vals));

                    // Use metric preset bounds or adjust dynamically if data exceeds
                    const gaugeMin = Math.min(metricConfig.min, observedMin);
                    const gaugeMax = Math.max(
                      metricConfig.max,
                      observedMax > gaugeMin ? observedMax : gaugeMin + 50
                    );

                    return (
                      <RadialGauge
                        title={`Status ${metricConfig.name}`}
                        value={latestVal}
                        min={gaugeMin}
                        max={gaugeMax}
                        unit={metricConfig.unit}
                        warningThreshold={metricConfig.warningThreshold}
                        criticalThreshold={metricConfig.criticalThreshold}
                        className="h-full flex flex-col justify-between"
                      />
                    );
                  })()}
                </div>

                {/* Advanced Timeseries Line Chart */}
                <Card className="card lg:col-span-3 border border-neutral-200 dark:border-slate-800 shadow-xs">
                  <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Grafik Tren Timeseries ({result.metric_name})
                      </CardTitle>
                      <p className="text-xs text-neutral-400">
                        Visualisasi interval:{" "}
                        <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                          {result.interval === "raw"
                            ? "Raw Realtime Data"
                            : result.interval === "1m"
                            ? "Agregasi 1 Menit (Avg, Min, Max)"
                            : "Agregasi 1 Jam (Avg, Min, Max)"}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {result.points.length} titik sampel
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <TelemetryChart
                      points={result.points}
                      metricName={result.metric_name}
                      unit={metricConfig.unit}
                      interval={result.interval}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* 3. Detailed Data Table */}
              <Card className="card border border-neutral-200 dark:border-slate-800 shadow-xs">
                <CardHeader className="p-4 pb-2 border-b border-neutral-100 dark:border-slate-800 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <CardTitle className="text-sm font-semibold">
                      Tabel Data Sensor / Telemetri
                    </CardTitle>
                    <span className="text-xs text-neutral-400">
                      (Halaman {page + 1})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTableSortDesc(!tableSortDesc)}
                      className="text-xs h-8 flex items-center gap-1.5 text-neutral-600 dark:text-slate-300"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Urutan: {tableSortDesc ? "Terbaru Dulu" : "Terlama Dulu"}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="px-0 py-0">
                  <Table>
                    <TableHeader className="bg-neutral-50 dark:bg-slate-900/60 text-xs">
                      <TableRow>
                        <TableHead className="w-48">Waktu (Timestamp)</TableHead>
                        <TableHead className="w-32">Waktu Relatif</TableHead>
                        {result.interval === "raw" ? (
                          <TableHead className="text-right">
                            Nilai ({metricConfig.unit || "Unit"})
                          </TableHead>
                        ) : (
                          <>
                            <TableHead className="text-right">Rata-rata (Avg)</TableHead>
                            <TableHead className="text-right">Minimum</TableHead>
                            <TableHead className="text-right">Maksimum</TableHead>
                            <TableHead className="text-center">Jumlah Sampel</TableHead>
                          </>
                        )}
                        <TableHead className="text-right">Status Nilai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {(() => {
                        const displayedPoints = tableSortDesc
                          ? [...result.points].reverse()
                          : result.points;

                        return displayedPoints.map((p, idx) => {
                          const val = p.value ?? p.avg ?? 0;
                          const isWarning = val >= metricConfig.warningThreshold;
                          const isCritical = val >= metricConfig.criticalThreshold;

                          return (
                            <TableRow
                              key={p.ts + idx}
                              className="hover:bg-neutral-50 dark:hover:bg-slate-900/50"
                            >
                              <TableCell className="font-mono text-neutral-600 dark:text-neutral-300">
                                {new Date(p.ts).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-neutral-400">
                                {(() => {
                                  try {
                                    const diffSec = Math.floor(
                                      (Date.now() - new Date(p.ts).getTime()) / 1000
                                    );
                                    if (diffSec < 60) return `${diffSec} dtk lalu`;
                                    const diffMin = Math.floor(diffSec / 60);
                                    if (diffMin < 60) return `${diffMin} mnt lalu`;
                                    const diffH = Math.floor(diffMin / 60);
                                    if (diffH < 24) return `${diffH} jam lalu`;
                                    return `${Math.floor(diffH / 24)} hari lalu`;
                                  } catch {
                                    return "-";
                                  }
                                })()}
                              </TableCell>
                              {result.interval === "raw" ? (
                                <TableCell className="text-right font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                                  {val.toFixed(2)} {metricConfig.unit}
                                </TableCell>
                              ) : (
                                <>
                                  <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                                    {p.avg?.toFixed(2)} {metricConfig.unit}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-cyan-600 dark:text-cyan-400">
                                    {p.min?.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-amber-600 dark:text-amber-400">
                                    {p.max?.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-neutral-500">
                                    {p.count}
                                  </TableCell>
                                </>
                              )}
                              <TableCell className="text-right">
                                {isCritical ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 text-[10px]"
                                  >
                                    Critical
                                  </Badge>
                                ) : isWarning ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px]"
                                  >
                                    Warning
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px]"
                                  >
                                    Normal
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>

                  {/* Pagination footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0 || loading}
                      onClick={() =>
                        fetchTelemetry(Math.max(0, (page - 1) * pageSize))
                      }
                      className="text-xs"
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs text-neutral-500">
                      Halaman <strong className="text-neutral-800 dark:text-neutral-200">{page + 1}</strong>
                      {result.has_more && " (Ada data lebih lanjut)"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!result.has_more || loading}
                      onClick={() => fetchTelemetry((page + 1) * pageSize)}
                      className="text-xs"
                    >
                      Berikutnya
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Initial loading placeholder if metadata still loading */}
      {!result && loading && (
        <Card className="card mb-6 border border-neutral-200 dark:border-slate-800">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Menghubungkan ke ClickHouse Telemetry Engine...
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Mengambil titik telemetri dan menghitung metrik agregasi.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function TelemetryPage() {
  return (
    <Suspense
      fallback={
        <Card className="card mb-6 border border-neutral-200 dark:border-slate-800">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Memuat Dashboard Telemetri...
            </p>
          </CardContent>
        </Card>
      }
    >
      <TelemetryPageContent />
    </Suspense>
  );
}
