"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Sun, DollarSign, PieChart, Leaf, TrendingUp } from "lucide-react"
import type { SpsPerformanceResponse } from "@/lib/types"
import { useTenantContext } from "@/contexts/TenantContext"
import { useAutoRefresh } from "@/contexts/AutoRefreshContext"
import { spsApi } from "@/lib/api-client"

interface GtaasSummaryCardsProps {
  performance?: SpsPerformanceResponse | null
  siteSlug?: string
}

export default function GtaasSummaryCards({
  performance: externalPerformance,
  siteSlug = "auto",
}: GtaasSummaryCardsProps) {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext()
  const { refreshTrigger } = useAutoRefresh()
  const [internalPerf, setInternalPerf] = useState<SpsPerformanceResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (externalPerformance !== undefined) return
    if (isSuperadmin && !selectedTenantSlug) {
      setInternalPerf(null)
      return
    }

    let isMounted = true
    setLoading(true)
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
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [externalPerformance, siteSlug, isSuperadmin, selectedTenantSlug, refreshTrigger])

  const p = externalPerformance ?? internalPerf ?? {
    solar_kwh: 0,
    grid_kwh: 0,
    load_kwh: 0,
    solar_contribution_pct: 0,
    performance_ratio_pct: 0,
    pln_cost_avoided_idr: 0,
    carbon_avoided_kg: 0,
    trees_equivalent: 0,
  }

  const cards = [
    {
      title: "Solar Energy Generated",
      value: loading ? "..." : `${p.solar_kwh.toFixed(2)} kWh`,
      subtitle: `24 Jam Terakhir (Total beban: ${p.load_kwh.toFixed(2)} kWh)`,
      icon: Sun,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-200 dark:border-amber-900/50",
      gradient: "from-amber-500/10 via-transparent to-transparent",
    },
    {
      title: "PLN Cost Avoided",
      value: loading ? "..." : `Rp ${Math.round(p.pln_cost_avoided_idr || 0).toLocaleString("id-ID")}`,
      subtitle: `Tarif PLN B3/I3 (Rp 1.444,70 / kWh)`,
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-200 dark:border-emerald-900/50",
      gradient: "from-emerald-500/10 via-transparent to-transparent",
    },
    {
      title: "Solar Contribution Ratio",
      value: loading ? "..." : `${p.solar_contribution_pct.toFixed(1)}%`,
      subtitle: `Performance Ratio: ${p.performance_ratio_pct.toFixed(1)}%`,
      icon: PieChart,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
      borderColor: "border-sky-200 dark:border-sky-900/50",
      gradient: "from-sky-500/10 via-transparent to-transparent",
    },
    {
      title: "ESG Carbon Avoidance",
      value: loading ? "..." : `${p.carbon_avoided_kg.toFixed(2)} kg CO₂e`,
      subtitle: `Setara menanam ~${p.trees_equivalent.toFixed(2)} pohon`,
      icon: Leaf,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
      borderColor: "border-teal-200 dark:border-teal-900/50",
      gradient: "from-teal-500/10 via-transparent to-transparent",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {cards.map((card, idx) => {
        const Icon = card.icon
        return (
          <Card
            key={idx}
            className={`relative overflow-hidden border ${card.borderColor} bg-white/70 dark:bg-slate-900/70 backdrop-blur shadow-sm`}
          >
            <div
              className={`absolute inset-0 bg-linear-to-br ${card.gradient} pointer-events-none`}
            />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg ${card.bgColor} ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {card.value}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span>{card.subtitle}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
