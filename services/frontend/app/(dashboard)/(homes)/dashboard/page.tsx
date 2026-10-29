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
import { AutoRefreshProvider, useAutoRefresh } from "@/contexts/AutoRefreshContext";
import { useTenantContext } from "@/contexts/TenantContext";
import { spsApi } from "@/lib/api-client";
import type { SpsPerformanceResponse } from "@/lib/types";
import { Suspense, useEffect, useState } from "react";

function DashboardContent() {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext();
  const { refreshTrigger } = useAutoRefresh();
  const [performance, setPerformance] = useState<SpsPerformanceResponse | null>(null);

  useEffect(() => {
    if (isSuperadmin && !selectedTenantSlug) {
      setPerformance(null);
      return;
    }

    let active = true;
    spsApi
      .getPerformance("auto", {
        tenant_slug: isSuperadmin ? selectedTenantSlug : undefined,
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
  }, [isSuperadmin, selectedTenantSlug, refreshTrigger]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <DashboardBreadcrumb title="HIGHLIGHT INFORMATION" text="Highlight Information" />
        <div className="flex items-center gap-2.5 flex-wrap">
          <AutoRefreshSelector />
          <TenantSelector />
        </div>
      </div>

      {/* GTaaS Executive KPI Cards (Solar, Cost Saved PLN, SCR, Carbon ESG) */}
      <div className="mb-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <GtaasSummaryCards performance={performance} />
        </Suspense>
      </div>

      {/* Legacy StatCard Row (Kept for 100% backward compatibility) */}
      <Suspense fallback={<LoadingSkeleton />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard />
        </div>
      </Suspense>

      {/* Interactive Power Flow & SLD Card */}
      <div className="mt-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <PowerFlowCard performance={performance} />
        </Suspense>
      </div>

      {/* Monitoring & Status Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <PmsHardwareStatusCard performance={performance} />
        </Suspense>
        <Suspense fallback={<LoadingSkeleton />}>
          <DeviceStatusCard />
        </Suspense>
        <Suspense fallback={<LoadingSkeleton />}>
          <MetricsSummaryCard />
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
