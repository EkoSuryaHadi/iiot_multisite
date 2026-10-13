"use client";

import DeviceStatusCard from "@/app/(dashboard)/(homes)/dashboard/components/device-status-card";
import MetricsSummaryCard from "@/app/(dashboard)/(homes)/dashboard/components/metrics-summary-card";
import StatCard from "@/app/(dashboard)/(homes)/dashboard/components/stat-card";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import TenantSelector from "@/components/shared/tenant-selector";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <DashboardBreadcrumb title="HIGHLIGHT INFORMATION" text="Highlight Information" />
        <TenantSelector />
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard />
        </div>
      </Suspense>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
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
