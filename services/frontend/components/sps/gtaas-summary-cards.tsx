"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Sun, DollarSign, PieChart, Leaf, TrendingUp } from "lucide-react"
import type { SpsPerformanceResponse } from "@/lib/types"

interface GtaasSummaryCardsProps {
  performance?: SpsPerformanceResponse | null
}

export default function GtaasSummaryCards({ performance }: GtaasSummaryCardsProps) {
  const p = performance || {
    solar_kwh: 16.8,
    grid_kwh: 4.5,
    load_kwh: 21.3,
    solar_contribution_pct: 78.87,
    performance_ratio_pct: 82.4,
    pln_cost_avoided_idr: 24270,
    carbon_avoided_kg: 14.28,
    trees_equivalent: 0.71,
  }

  const cards = [
    {
      title: "Solar Energy Generated",
      value: `${p.solar_kwh.toFixed(1)} kWh`,
      subtitle: `Hari ini (Total beban: ${p.load_kwh.toFixed(1)} kWh)`,
      icon: Sun,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-200 dark:border-amber-900/50",
      gradient: "from-amber-500/10 via-transparent to-transparent",
    },
    {
      title: "PLN Cost Avoided",
      value: `Rp ${(p.pln_cost_avoided_idr || 0).toLocaleString("id-ID")}`,
      subtitle: `Tarif PLN B3/I3 (Rp 1.444,70 / kWh)`,
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-200 dark:border-emerald-900/50",
      gradient: "from-emerald-500/10 via-transparent to-transparent",
    },
    {
      title: "Solar Contribution Ratio",
      value: `${p.solar_contribution_pct.toFixed(1)}%`,
      subtitle: `Performance Ratio: ${p.performance_ratio_pct.toFixed(1)}%`,
      icon: PieChart,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
      borderColor: "border-sky-200 dark:border-sky-900/50",
      gradient: "from-sky-500/10 via-transparent to-transparent",
    },
    {
      title: "ESG Carbon Avoidance",
      value: `${p.carbon_avoided_kg.toFixed(1)} kg CO₂e`,
      subtitle: `Setara menanam ~${p.trees_equivalent.toFixed(1)} pohon`,
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

