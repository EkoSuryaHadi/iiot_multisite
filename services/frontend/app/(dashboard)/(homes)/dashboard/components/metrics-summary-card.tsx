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
import { useTenantContext } from "@/contexts/TenantContext";
import { analyticsApi, ApiRequestError } from "@/lib/api-client";
import type { MetricSummary } from "@/lib/types";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const MetricsSummaryCard = () => {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext();
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperadmin && !selectedTenantSlug) return;
    let active = true;
    setLoading(true);

    analyticsApi
      .getSummaryTenant({ tenant_slug: isSuperadmin ? selectedTenantSlug : undefined })
      .then((res) => active && setMetrics(res.metrics))
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
        <CardTitle className="text-lg">Ringkasan Metrik (1 Jam Terakhir)</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <p className="text-sm text-neutral-500 px-6">Memuat...</p>
        ) : metrics.length === 0 ? (
          <p className="text-sm text-neutral-500 px-6">Belum ada telemetry pada jam terakhir.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metrik</TableHead>
                <TableHead>Avg</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Sampel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.metric_name}>
                  <TableCell className="font-medium">{m.metric_name}</TableCell>
                  <TableCell>{m.avg.toFixed(2)}</TableCell>
                  <TableCell>{m.min.toFixed(2)}</TableCell>
                  <TableCell>{m.max.toFixed(2)}</TableCell>
                  <TableCell>{m.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricsSummaryCard;
