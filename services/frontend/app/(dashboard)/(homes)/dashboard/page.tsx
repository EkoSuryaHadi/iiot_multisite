"use client";

import DeviceStatusCard from "@/app/(dashboard)/(homes)/dashboard/components/device-status-card";
import MetricsSummaryCard from "@/app/(dashboard)/(homes)/dashboard/components/metrics-summary-card";
import StatCard from "@/app/(dashboard)/(homes)/dashboard/components/stat-card";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import TenantSelector from "@/components/shared/tenant-selector";
import AutoRefreshSelector from "@/components/shared/auto-refresh-selector";
import LoadingSkeleton from "@/components/loading-skeleton";
import PowerFlowCard from "@/components/sps/power-flow-card";
import GtaasSummaryCards from "@/components/sps/gtaas-summary-cards";
import PmsHardwareStatusCard from "@/components/sps/pms-hardware-status-card";
import PvHealthCard from "@/components/sps/pv-health-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutoRefreshProvider, useAutoRefresh } from "@/contexts/AutoRefreshContext";
import { useTenantContext } from "@/contexts/TenantContext";
import { devicesApi, sitesApi, spsApi } from "@/lib/api-client";
import type { Device, Site, SpsPerformanceResponse } from "@/lib/types";
import { MapPin, Server } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";

function DashboardContent() {
  const { isSuperadmin, selectedTenant, selectedTenantSlug } = useTenantContext();
  const { refreshTrigger } = useAutoRefresh();
  const [performance, setPerformance] = useState<SpsPerformanceResponse | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedSiteSlug, setSelectedSiteSlug] = useState<string>("auto");
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string>("ALL");

  useEffect(() => {
    if (isSuperadmin && !selectedTenant) {
      return;
    }
    let active = true;
    Promise.all([sitesApi.list().catch(() => []), devicesApi.list().catch(() => [])]).then(
      ([allSites, allDevices]) => {
        if (!active) return;
        const scopedSites =
          isSuperadmin && selectedTenant
            ? allSites.filter((s) => s.tenant_id === selectedTenant.id)
            : allSites;
        const scopedDevices =
          isSuperadmin && selectedTenant
            ? allDevices.filter((d) => d.tenant_id === selectedTenant.id)
            : allDevices;
        setSites(scopedSites);
        setDevices(scopedDevices);
        setSelectedSiteSlug((prev) =>
          prev !== "auto" && scopedSites.some((s) => s.slug === prev)
            ? prev
            : scopedSites[0]?.slug ?? "auto"
        );
      }
    );
    return () => {
      active = false;
    };
  }, [isSuperadmin, selectedTenant]);

  const visibleSites = useMemo(
    () => (isSuperadmin && !selectedTenant ? [] : sites),
    [isSuperadmin, selectedTenant, sites]
  );

  const visibleDevices = useMemo(
    () => (isSuperadmin && !selectedTenant ? [] : devices),
    [isSuperadmin, selectedTenant, devices]
  );

  const activeSite = useMemo(
    () => visibleSites.find((s) => s.slug === selectedSiteSlug) ?? visibleSites[0] ?? null,
    [visibleSites, selectedSiteSlug]
  );

  const siteDevices = useMemo(
    () => (activeSite ? visibleDevices.filter((d) => d.site_id === activeSite.id) : visibleDevices),
    [visibleDevices, activeSite]
  );

  const effectiveDeviceKey =
    selectedDeviceKey !== "ALL" && siteDevices.some((d) => d.device_key === selectedDeviceKey)
      ? selectedDeviceKey
      : "ALL";

  const effectiveSiteSlug = activeSite?.slug || selectedSiteSlug || "auto";

  useEffect(() => {
    if (isSuperadmin && !selectedTenantSlug) {
      return;
    }

    let active = true;
    spsApi
      .getPerformance(effectiveSiteSlug, {
        tenant_slug: isSuperadmin ? selectedTenantSlug : undefined,
        device_key: effectiveDeviceKey !== "ALL" ? effectiveDeviceKey : undefined,
      })
      .then((res) => {
        if (active) setPerformance(res);
      })
      .catch(() => {
        if (active) setPerformance(null);
      });

    return () => {
      active = false;
    };
  }, [isSuperadmin, selectedTenantSlug, effectiveSiteSlug, effectiveDeviceKey, refreshTrigger]);

  const displayedPerformance = isSuperadmin && !selectedTenantSlug ? null : performance;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <DashboardBreadcrumb title="HIGHLIGHT INFORMATION" text="Highlight Information" />
        <div className="flex items-center gap-2.5 flex-wrap">
          <AutoRefreshSelector />
          {visibleSites.length > 0 && (
            <Select value={effectiveSiteSlug} onValueChange={setSelectedSiteSlug}>
              <SelectTrigger className="w-[190px] bg-white dark:bg-slate-800 h-9 text-xs">
                <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-500 shrink-0" />
                <SelectValue placeholder="Pilih Child Node (Site)" />
              </SelectTrigger>
              <SelectContent>
                {visibleSites.map((s) => (
                  <SelectItem key={s.id} value={s.slug}>
                    {s.name} ({s.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {siteDevices.length > 1 && (
            <Select value={effectiveDeviceKey} onValueChange={setSelectedDeviceKey}>
              <SelectTrigger className="w-[190px] bg-white dark:bg-slate-800 h-9 text-xs">
                <Server className="w-3.5 h-3.5 mr-1 text-sky-500 shrink-0" />
                <SelectValue placeholder="Semua Device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Device ({siteDevices.length})</SelectItem>
                {siteDevices.map((d) => (
                  <SelectItem key={d.id} value={d.device_key}>
                    {d.name} ({d.device_key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <TenantSelector />
        </div>
      </div>

      {/* GTaaS Executive KPI Cards (Solar, Cost Saved PLN, SCR, Carbon ESG) */}
      <div className="mb-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <GtaasSummaryCards performance={displayedPerformance} />
        </Suspense>
      </div>

      {/* Legacy StatCard Row (Kept for 100% backward compatibility) */}
      <Suspense fallback={<LoadingSkeleton />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard siteSlug={effectiveSiteSlug} />
        </div>
      </Suspense>

      {/* Interactive Power Flow & SLD Card */}
      <div className="mt-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <PowerFlowCard siteSlug={effectiveSiteSlug} performance={displayedPerformance} />
        </Suspense>
      </div>

      {/* SPS & PMS Diagnostics (RKS 2.3.3.b & 2.3.3.c) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <PvHealthCard siteSlug={effectiveSiteSlug} />
        </Suspense>
        <Suspense fallback={<LoadingSkeleton />}>
          <PmsHardwareStatusCard siteSlug={effectiveSiteSlug} performance={displayedPerformance} />
        </Suspense>
      </div>

      {/* Device & Telemetry Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <DeviceStatusCard siteSlug={effectiveSiteSlug} />
        </Suspense>
        <Suspense fallback={<LoadingSkeleton />}>
          <MetricsSummaryCard siteSlug={effectiveSiteSlug} />
        </Suspense>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AutoRefreshProvider defaultInterval={30000}>
      <DashboardContent />
    </AutoRefreshProvider>
  );
}
