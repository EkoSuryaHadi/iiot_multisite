"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantContext } from "@/contexts/TenantContext";
import { analyticsApi, ApiRequestError } from "@/lib/api-client";
import type { DeviceStatusItem } from "@/lib/types";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const DeviceStatusCard = () => {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext();
  const [devices, setDevices] = useState<DeviceStatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperadmin && !selectedTenantSlug) return;
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
  }, [isSuperadmin, selectedTenantSlug]);

  return (
    <Card className="card">
      <CardHeader>
        <CardTitle className="text-lg">Status Device</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <p className="text-sm text-neutral-500 px-6">Memuat...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-neutral-500 px-6">Belum ada device yang mengirim data.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Terlihat Terakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={`${d.site_slug}-${d.device_key}`}>
                  <TableCell>{d.site_slug}</TableCell>
                  <TableCell className="font-medium">{d.device_key}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        d.status === "online"
                          ? "bg-green-600 text-white"
                          : "bg-neutral-400 text-white dark:bg-neutral-600"
                      }
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {new Date(d.last_seen).toLocaleString()}
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
