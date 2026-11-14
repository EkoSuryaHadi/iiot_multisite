"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  SunMedium,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Thermometer,
  Layers,
  Zap,
} from "lucide-react"
import type { SpsHealthResponse } from "@/lib/types"
import { useTenantContext } from "@/contexts/TenantContext"
import { useAutoRefresh } from "@/contexts/AutoRefreshContext"
import { spsApi } from "@/lib/api-client"

interface PvHealthCardProps {
  siteSlug?: string
  health?: SpsHealthResponse | null
}

export default function PvHealthCard({
  siteSlug = "auto",
  health: externalHealth,
}: PvHealthCardProps) {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext()
  const { refreshTrigger } = useAutoRefresh()
  const [internalHealth, setInternalHealth] = useState<SpsHealthResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (externalHealth !== undefined) return
    if (isSuperadmin && !selectedTenantSlug) {
      setInternalHealth(null)
      return
    }

    let isMounted = true
    setLoading(true)
    spsApi
      .getHealth(siteSlug, {
        tenant_slug: isSuperadmin ? selectedTenantSlug : undefined,
      })
      .then((res) => {
        if (isMounted) setInternalHealth(res)
      })
      .catch(() => {
        if (isMounted) setInternalHealth(null)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [externalHealth, siteSlug, isSuperadmin, selectedTenantSlug, refreshTrigger])

  const data = externalHealth ?? internalHealth
  const pv = data?.pv_health
  const mppt = data?.mppt_health
  const overallStatus = data?.status ?? "HEALTHY"
  const siteHealthIndex = data?.site_health_index ?? pv?.health_index ?? 100.0
  const resolvedSite = data?.site_slug || (siteSlug === "auto" ? "-" : siteSlug)

  const isHealthy = overallStatus === "HEALTHY"
  const isWarning = overallStatus === "WARNING"
  const isDegraded = overallStatus === "DEGRADED" || overallStatus === "CRITICAL"

  const maxStringCurrent =
    pv?.string_currents && pv.string_currents.length > 0
      ? Math.max(...pv.string_currents)
      : 0

  const stringCount = Math.max(
    pv?.string_currents?.length ?? 0,
    pv?.string_voltages?.length ?? 0
  )

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <div className="flex items-center gap-2">
            <SunMedium className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-bold">
              Kesehatan PV & MPPT (RKS 2.3.3.b)
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Site: <span className="font-semibold">{resolvedSite}</span> | Performance Ratio & Anomali String
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={
            isDegraded
              ? "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 animate-pulse"
              : isWarning
                ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                : "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
          }
        >
          {isDegraded ? "Degradasi / Kritis" : isWarning ? "Peringatan" : "Kondisi Sehat"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 pt-2 text-xs">
        {/* PV Health Score & Performance Ratio */}
        <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                PV Array Health Index
              </span>
            </div>
            <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
              {pv ? `${pv.health_index.toFixed(1)}%` : loading ? "..." : "100.0%"}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between text-slate-500">
            <span>Performance Ratio (PR):</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {pv ? `${pv.performance_ratio_pct.toFixed(1)}%` : "0.0%"} (Target ≥ 80%)
            </span>
          </div>

          {/* Health Index Progress Bar */}
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (pv?.health_index ?? 100) >= 80
                  ? "bg-emerald-500"
                  : (pv?.health_index ?? 100) >= 60
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, pv?.health_index ?? 100))}%` }}
            />
          </div>
        </div>

        {/* String Anomaly Monitoring (RKS Pasal 2.4.2 butir A2: deviasi > 5%) */}
        <div
          className={`p-2.5 rounded-lg border transition-colors ${
            pv?.string_anomaly
              ? "border-rose-300 dark:border-rose-800/80 bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
              : "border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              {pv?.string_anomaly ? (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 animate-bounce" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span className="font-medium text-[11px]">
                Monitoring Tegangan &amp; Arus Antar-String (RKS 2.3.3.a &amp; 2.4.2)
              </span>
            </div>
            <span
              className={`font-mono text-[11px] font-semibold ${
                pv?.string_anomaly ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              Deviasi: {pv ? `${pv.max_string_deviation_pct.toFixed(1)}%` : "0.0%"}
            </span>
          </div>

          {/* String Voltages & Currents Grid */}
          {stringCount > 0 ? (
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {Array.from({ length: stringCount }).map((_, idx) => {
                const current = pv?.string_currents?.[idx] ?? 0
                const voltage = pv?.string_voltages?.[idx] ?? 0
                const isUnderperforming =
                  maxStringCurrent > 0 &&
                  ((maxStringCurrent - current) / maxStringCurrent) * 100 > 5.0
                return (
                  <div
                    key={idx}
                    className={`p-1.5 rounded border text-center font-mono text-[10px] ${
                      isUnderperforming
                        ? "border-rose-400 bg-rose-100/60 dark:border-rose-800 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold"
                        : "border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="text-[9px] text-slate-400">Str {idx + 1}</div>
                    <div className="font-semibold text-amber-600 dark:text-amber-400">{voltage.toFixed(1)} V</div>
                    <div>{current.toFixed(1)} A</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              <div className="grid grid-cols-4 gap-1.5">
                <div className="p-1.5 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 text-center font-mono text-[10px] text-slate-400">
                  <div className="text-[9px]">Str 1</div>
                  <div className="font-semibold">0.0 V</div>
                  <div>0.0 A</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Layers className="h-3 w-3 shrink-0" />
                <span>Belum ada data string aktif (Perangkat Offline / Tegangan PV 0 V).</span>
              </div>
            </div>
          )}
        </div>

        {/* MPPT Health & Efisiensi Konversi (RKS Pasal 2.3.2) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Efisiensi MPPT */}
          <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mb-1">
              <Cpu className="h-3.5 w-3.5 text-sky-500" />
              <span className="font-medium text-[11px]">Efisiensi MPPT</span>
            </div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {mppt ? `${mppt.efficiency_pct.toFixed(1)}%` : "98.0%"}
            </div>
            <div
              className={`text-[10px] mt-0.5 ${
                mppt?.is_efficiency_ok !== false
                  ? "text-emerald-500"
                  : "text-rose-500 font-semibold"
              }`}
            >
              {mppt?.is_efficiency_ok !== false ? "Memenuhi Target ≥ 97%" : "Drop di bawah 97%"}
            </div>
          </div>

          {/* Suhu MPPT */}
          <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mb-1">
              <Thermometer className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium text-[11px]">Suhu MPPT</span>
            </div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {mppt ? `${mppt.temp_mppt_c.toFixed(1)} °C` : "Normal"}
            </div>
            <div
              className={`text-[10px] mt-0.5 ${
                mppt?.is_temperature_ok !== false
                  ? "text-emerald-500"
                  : "text-rose-500 font-semibold"
              }`}
            >
              {mppt?.is_temperature_ok !== false ? "Batas Aman < 70°C" : "Overheat (≥ 70°C)"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
