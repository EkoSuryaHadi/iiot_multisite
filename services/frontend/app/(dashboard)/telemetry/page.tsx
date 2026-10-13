"use client";

import TelemetryChart from "@/app/(dashboard)/telemetry/components/telemetry-chart";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import TenantSelector from "@/components/shared/tenant-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
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
import type { Device, Site, TelemetryResponse } from "@/lib/types";
import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

function toInputDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TelemetryPage() {
  const { isSuperadmin, selectedTenant } = useTenantContext();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [metricName, setMetricName] = useState("temp");
  const [interval, setInterval] = useState<"raw" | "1m" | "1h">("raw");
  const [start, setStart] = useState(() => toInputDateTime(new Date(Date.now() - 60 * 60 * 1000)));
  const [end, setEnd] = useState(() => toInputDateTime(new Date()));
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TelemetryResponse | null>(null);

  const loadDevices = useCallback(async () => {
    if (isSuperadmin && !selectedTenant) return;
    try {
      const [allDevices, allSites] = await Promise.all([devicesApi.list(), sitesApi.list()]);
      const scopedDevices =
        isSuperadmin && selectedTenant ? allDevices.filter((d) => d.tenant_id === selectedTenant.id) : allDevices;
      const scopedSites =
        isSuperadmin && selectedTenant ? allSites.filter((s) => s.tenant_id === selectedTenant.id) : allSites;
      setDevices(scopedDevices);
      setSites(scopedSites);
      setDeviceId((prev) => prev || scopedDevices[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memuat device");
    }
  }, [isSuperadmin, selectedTenant]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const selectedDevice = devices.find((d) => d.id === deviceId);
  const selectedSite = sites.find((s) => s.id === selectedDevice?.site_id);

  const handleSearch = async (e?: React.FormEvent, offset = 0) => {
    e?.preventDefault();
    if (!selectedDevice) {
      toast.error("Pilih device terlebih dahulu");
      return;
    }
    setLoading(true);
    setPage(offset / pageSize);
    try {
      const res = await analyticsApi.getTelemetry({
        device_key: selectedDevice.device_key,
        site_slug: selectedSite?.slug,
        tenant_slug: isSuperadmin ? selectedTenant?.slug : undefined,
        metric_name: metricName,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        interval,
        limit: pageSize,
        offset,
      });
      setResult(res);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memuat telemetry");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <DashboardBreadcrumb title="TELEMETRY" text="Telemetry" />
        <TenantSelector />
      </div>

      <Card className="card mb-6">
        <CardContent>
          <form onSubmit={(e) => handleSearch(e, 0)} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Device</Label>
              <Select value={deviceId} onValueChange={(v) => v && setDeviceId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih device">
                    {selectedDevice ? `${selectedDevice.name} (${selectedDevice.device_key})` : ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.device_key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Metrik</Label>
              <Input value={metricName} onChange={(e) => setMetricName(e.target.value)} placeholder="temp" required />
            </div>
            <div className="space-y-1.5">
              <Label>Dari</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Sampai</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Interval</Label>
              <Select value={interval} onValueChange={(v) => setInterval(v as "raw" | "1m" | "1h")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw</SelectItem>
                  <SelectItem value="1m">1 menit</SelectItem>
                  <SelectItem value="1h">1 jam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-6">
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Tampilkan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="card mb-6">
            <CardContent>
              {result.points.length === 0 ? (
                <p className="text-sm text-neutral-500">Tidak ada data pada rentang waktu ini.</p>
              ) : (
                <TelemetryChart points={result.points} metricName={result.metric_name} />
              )}
            </CardContent>
          </Card>

          <Card className="card">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    {result.interval === "raw" ? (
                      <TableHead>Nilai</TableHead>
                    ) : (
                      <>
                        <TableHead>Avg</TableHead>
                        <TableHead>Min</TableHead>
                        <TableHead>Max</TableHead>
                        <TableHead>Sampel</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.points.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(p.ts).toLocaleString()}</TableCell>
                      {result.interval === "raw" ? (
                        <TableCell>{p.value}</TableCell>
                      ) : (
                        <>
                          <TableCell>{p.avg?.toFixed(2)}</TableCell>
                          <TableCell>{p.min?.toFixed(2)}</TableCell>
                          <TableCell>{p.max?.toFixed(2)}</TableCell>
                          <TableCell>{p.count}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-6 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || loading}
                  onClick={() => handleSearch(undefined, Math.max(0, (page - 1) * pageSize))}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-neutral-500">Halaman {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!result.has_more || loading}
                  onClick={() => handleSearch(undefined, (page + 1) * pageSize)}
                >
                  Berikutnya
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
