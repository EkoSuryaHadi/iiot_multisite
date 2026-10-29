"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Battery, BatteryCharging, Wifi, ArrowUpCircle, ShieldCheck, HardDrive } from "lucide-react"
import type { SpsPerformanceResponse } from "@/lib/types"
import { useTenantContext } from "@/contexts/TenantContext"
import { useAutoRefresh } from "@/contexts/AutoRefreshContext"
import { spsApi } from "@/lib/api-client"

interface PmsHardwareStatusProps {
  siteSlug?: string
  performance?: SpsPerformanceResponse | null
  powerSource?: "DC_MAINS" | "INTERNAL_UPS" | "OFFLINE"
  batteryVoltage?: number
  batteryPct?: number
  upsHoursRemaining?: number
  signalRssi?: number | null
  firmwareVersion?: string
  otaStatus?: "UP_TO_DATE" | "UPDATE_AVAILABLE" | "UPDATING"
}

export default function PmsHardwareStatusCard({
  siteSlug = "auto",
  performance: externalPerformance,
  powerSource: propPowerSource,
  batteryVoltage: propBatteryVoltage,
  batteryPct: propBatteryPct,
  upsHoursRemaining: propUpsHours,
  signalRssi: propSignalRssi,
  firmwareVersion: propFwVersion,
  otaStatus: propOtaStatus,
}: PmsHardwareStatusProps) {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext()
  const { refreshTrigger } = useAutoRefresh()
  const [internalPerf, setInternalPerf] = useState<SpsPerformanceResponse | null>(null)

  useEffect(() => {
    if (externalPerformance !== undefined) return
    if (isSuperadmin && !selectedTenantSlug) {
      setInternalPerf(null)
      return
    }

    let isMounted = true
    spsApi
      .getPerformance(siteSlug, {
        tenant_slug: isSuperadmin ? selectedTenantSlug : undefined,
      })
      .then((res) => {
        if (isMounted) setInternalPerf(res)
      })
      .catch(() => {
        if (isMounted) setInternalPerf(null)
      })

    return () => {
      isMounted = false
    }
  }, [externalPerformance, siteSlug, isSuperadmin, selectedTenantSlug, refreshTrigger])

  const data = externalPerformance ?? internalPerf
  const pms = data?.pms_status
  const isOnline = data?.is_online ?? false
  const resolvedSite = data?.site_slug || (siteSlug === "auto" ? "-" : siteSlug)

  const powerSource = propPowerSource ?? pms?.power_source ?? (isOnline ? "DC_MAINS" : "OFFLINE")
  const batteryVoltage = propBatteryVoltage ?? pms?.battery_voltage ?? 0
  const batteryPct = propBatteryPct ?? pms?.battery_pct ?? 0
  const upsHoursRemaining = propUpsHours ?? pms?.ups_hours_remaining ?? 0
  const signalRssi = propSignalRssi !== undefined ? propSignalRssi : pms?.signal_rssi
  const firmwareVersion = propFwVersion ?? pms?.firmware_version ?? "v2.4.1-ota-build-2026"
  const otaStatus = propOtaStatus ?? pms?.ota_status ?? "UP_TO_DATE"

  const isMainsActive = powerSource === "DC_MAINS" && isOnline
  const isUpsHealthy = upsHoursRemaining >= 3.0

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-sky-500" />
            <CardTitle className="text-sm font-bold">
              Monitoring Hardware PMS (RKS 2.3.3.c)
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Site: <span className="font-semibold">{resolvedSite}</span> | Catu Daya Cadangan 3 Jam & Remote OTA
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={
            !isOnline
              ? "border-slate-400 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50"
              : isMainsActive
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 animate-pulse"
          }
        >
          {!isOnline
            ? "Logger Offline"
            : isMainsActive
              ? "DC −48V Normal"
              : "Mode Baterai UPS Cadangan"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 pt-2 text-xs">
        {/* UPS 3 Jam Card */}
        <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMainsActive ? (
                <BatteryCharging className="h-4 w-4 text-emerald-500" />
              ) : (
                <Battery className="h-4 w-4 text-amber-500" />
              )}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                UPS Internal Logger / Baterai
              </span>
            </div>
            <span className="font-mono text-xs text-slate-500">
              {batteryVoltage.toFixed(1)} V ({batteryPct.toFixed(0)}%)
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-500">Daya Tahan Saat Blackout:</span>
            <span className={`font-bold ${isUpsHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
              {upsHoursRemaining.toFixed(1)} Jam (Target Min. 3 Jam)
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${isUpsHealthy ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min(100, (upsHoursRemaining / 3.0) * 100)}%` }}
            />
          </div>
        </div>

        {/* 4G Network & OTA Firmware Status */}
        <div className="grid grid-cols-2 gap-2">
          {/* 4G/LTE */}
          <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mb-1">
              <Wifi className="h-3.5 w-3.5 text-sky-500" />
              <span className="font-medium text-[11px]">Koneksi 4G / LTE</span>
            </div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {signalRssi ? `${signalRssi} dBm` : isOnline ? "Terhubung" : "Tidak Ada Sinyal"}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {isOnline ? "SIM Unlocked (Online)" : "Store & Forward Buffer Aktif"}
            </div>
          </div>

          {/* Remote OTA */}
          <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mb-1">
              <ArrowUpCircle className="h-3.5 w-3.5 text-purple-500" />
              <span className="font-medium text-[11px]">Firmware Remote OTA</span>
            </div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {firmwareVersion}
            </div>
            <div className="text-[10px] text-emerald-500 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>{otaStatus === "UP_TO_DATE" ? "Up to Date" : otaStatus}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
