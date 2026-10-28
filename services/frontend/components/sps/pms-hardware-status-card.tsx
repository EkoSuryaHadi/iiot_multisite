"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Battery, BatteryCharging, Wifi, ArrowUpCircle, ShieldCheck, HardDrive } from "lucide-react"

interface PmsHardwareStatusProps {
  siteSlug?: string
  powerSource?: "DC_MAINS" | "INTERNAL_UPS"
  batteryVoltage?: number
  batteryPct?: number
  upsHoursRemaining?: number
  signalRssi?: number
  firmwareVersion?: string
  otaStatus?: "UP_TO_DATE" | "UPDATE_AVAILABLE" | "UPDATING"
}

export default function PmsHardwareStatusCard({
  siteSlug = "site-jkt-01",
  powerSource = "DC_MAINS",
  batteryVoltage = 12.6,
  batteryPct = 95,
  upsHoursRemaining = 3.2,
  signalRssi = -68,
  firmwareVersion = "v2.4.1-ota-build-2026",
  otaStatus = "UP_TO_DATE",
}: PmsHardwareStatusProps) {
  const isMainsActive = powerSource === "DC_MAINS"
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
            Site: {siteSlug} | Catu Daya Cadangan 3 Jam & Remote OTA
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={
            isMainsActive
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
              : "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 animate-pulse"
          }
        >
          {isMainsActive ? "DC −48V Normal" : "Mode Baterai UPS Cadangan"}
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
                UPS Internal Logger
              </span>
            </div>
            <span className="font-mono text-xs text-slate-500">
              {batteryVoltage.toFixed(1)} V ({batteryPct}%)
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-500">Daya Tahan Saat Blackout:</span>
            <span className={`font-bold ${isUpsHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
              {upsHoursRemaining.toFixed(1)} Jam (Min. 3 Jam)
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
              {signalRssi} dBm (Bagus)
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">SIM Unlocked</div>
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
