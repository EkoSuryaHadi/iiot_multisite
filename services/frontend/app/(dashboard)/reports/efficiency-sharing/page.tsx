"use client"

import { useEffect, useState } from "react"
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb"
import TenantSelector from "@/components/shared/tenant-selector"
import BillingStatementTable from "@/components/reports/billing-statement-table"
import { spsApi } from "@/lib/api-client"
import type { SpsDailyEnergyRecord } from "@/lib/types"
import { useTenantContext } from "@/contexts/TenantContext"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, Loader2 } from "lucide-react"

export default function EfficiencySharingPage() {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext()
  const [resolvedSiteSlug, setResolvedSiteSlug] = useState("auto")
  const [records, setRecords] = useState<SpsDailyEnergyRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isSuperadmin && !selectedTenantSlug) {
      setRecords([])
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    const fetchDailyData = async () => {
      try {
        const res = await spsApi.getDaily("auto", {
          tenant_slug: isSuperadmin ? selectedTenantSlug : undefined,
          limit: 31,
        })
        if (isMounted) {
          if (res.site_slug) setResolvedSiteSlug(res.site_slug)
          setRecords(res.records || [])
          setLoading(false)
          return
        }
      } catch {
        if (isMounted) {
          setRecords([])
          setLoading(false)
        }
      }
    }

    fetchDailyData()
    return () => {
      isMounted = false
    }
  }, [isSuperadmin, selectedTenantSlug])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardBreadcrumb
          title="LAPORAN EFISIENSI SHARING (GTaaS)"
          text="Rekonsiliasi Penghematan Energi & Bagi Hasil SPS On-Grid"
        />
        <div className="flex items-center gap-2.5 flex-wrap">
          <TenantSelector />
        </div>
      </div>

      {/* Header Info Banner */}
      <Card className="border-emerald-500/30 bg-linear-to-r from-emerald-950/20 via-slate-900/40 to-slate-900/20 text-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h3 className="font-bold text-white text-base">
                Lembar Rekonsiliasi Tagihan Bulanan Mitratel GTaaS
              </h3>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Perhitungan bagi hasil penghematan listrik PLN berbasis Solar Contribution Ratio (SCR) aktual
              dengan jaminan retensi data operasional 24 bulan (730 hari) di ClickHouse sesuai RKS Pasal 2.3.3.c.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
              Site: <strong className="text-emerald-400">{resolvedSiteSlug === "auto" ? "-" : resolvedSiteSlug}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
              Retensi: <strong className="text-sky-400">24 Bulan</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Statement Table */}
      <BillingStatementTable
        siteSlug={resolvedSiteSlug === "auto" ? "-" : resolvedSiteSlug}
        records={records}
        sharingRatioPct={50.0}
        plnTariffIdr={1444.70}
      />
    </div>
  )
}
