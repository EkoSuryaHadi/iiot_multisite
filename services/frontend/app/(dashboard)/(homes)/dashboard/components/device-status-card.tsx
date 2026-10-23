"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimeAgo, StatusPulse } from "@/components/shared/status-pulse";
import { useAutoRefresh } from "@/contexts/AutoRefreshContext";
import { useTenantContext } from "@/contexts/TenantContext";
import { analyticsApi, ApiRequestError } from "@/lib/api-client";
import type { DeviceStatusItem } from "@/lib/types";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const DeviceStatusCard = () => {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext();
  const { refreshTrigger } = useAutoRefresh();
  const [devices, setDevices] = useState<DeviceStatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperadmin && !selectedTenantSlug) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    analyticsApi
      .getDevicesStatus({ tenant_slug: isSuperadmin ? selectedTenantSlug : undefined, limit: 20 })
      .then((res) => active && setDevices(res.devices))
      .catch((error) => {
        if (error instanceof ApiRequestError) toast.error(error.message);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [isSuperadmin, selectedTenantSlug, refreshTrigger]);

  return (
    <Card className="card border border-neutral-200 dark:border-slate-700 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Status Device</CardTitle>
          <span className="text-xs text-neutral-500 font-medium">{devices.length} Perangkat</span>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <p className="text-sm text-neutral-500 px-6 py-4">Memuat data terbaru...</p>
        ) : isSuperadmin && !selectedTenantSlug ? (
          <p className="text-sm text-neutral-500 px-6 py-4">Pilih tenant terlebih dahulu di pojok kanan atas.</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-neutral-500 px-6 py-4">Belum ada device yang mengirim data.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-200 dark:border-slate-700">
                <TableHead className="ps-6">Site</TableHead>
                <TableHead>Device Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pe-6 text-end">Terlihat Terakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={`${d.site_slug}-${d.device_key}`} className="border-neutral-100 dark:border-slate-800">
                  <TableCell className="ps-6 font-medium text-neutral-700 dark:text-neutral-300">{d.site_slug}</TableCell>
                  <TableCell className="font-mono text-xs">{d.device_key}</TableCell>
                  <TableCell>
                    <StatusPulse status={d.status} />
                  </TableCell>
                  <TableCell className="pe-6 text-end">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {formatTimeAgo(d.last_seen)}
                    </span>
                    <span className="block text-[11px] text-neutral-400">
                      {new Date(d.last_seen).toLocaleTimeString()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceStatusCard;
