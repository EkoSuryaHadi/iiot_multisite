"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sun, Zap, Radio, Activity, Eye, ArrowRight, Cpu, Loader2 } from "lucide-react"
import type { SpsPerformanceResponse } from "@/lib/types"
import { spsApi } from "@/lib/api-client"
import SingleLineDiagramModal from "./single-line-diagram-modal"

interface PowerFlowCardProps {
  siteSlug?: string
  tenantSlug?: string
}

export default function PowerFlowCard({
  siteSlug = "site-jkt-01",
  tenantSlug,
}: PowerFlowCardProps) {
  const [data, setData] = useState<SpsPerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sldOpen, setSldOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        const res = await spsApi.getPerformance(siteSlug, { tenant_slug: tenantSlug })
        if (isMounted) setData(res)
      } catch {
        // Fallback demo data jika backend/site belum ada data live
        if (isMounted) {
          setData({
            tenant_slug: tenantSlug || "mitratel",
            site_slug: siteSlug,
            site_config: {
              site_type: "TYPE_A",
              pv_capacity_kwp: 5.85,
              mppt_capacity_a: 80.0,
              rectifier_float_voltage: 53.5,
              baseline_kwh_daily: 72.0,
            },
            solar_kwh: 16.8,
            grid_kwh: 4.5,
            load_kwh: 21.3,
            solar_contribution_pct: 78.87,
            performance_ratio_pct: 82.4,
            pln_cost_avoided_idr: 24270,
            carbon_avoided_kg: 14.28,
            trees_equivalent: 0.71,
            power_flow: {
              irradiance: 845.0,
              v_pv: 182.6,
              i_pv: 16.1,
              p_pv: 2939.8,
              v_mppt_out: 54.2,
              i_mppt_out: 52.8,
              p_mppt_out: 2861.8,
              v_busbar: 53.8,
              i_rectifier: 11.2,
              p_rectifier: 602.6,
              p_load: 3464.4,
              temp_mppt: 42.1,
              rectifier_float_voltage: 53.5,
              voltage_delta_v: 0.7,
              load_sharing_active: true,
            },
          })
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    const timer = setInterval(fetchData, 15000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [siteSlug, tenantSlug])

  const pf = data?.power_flow

  return (
    <>
      <Card className="col-span-full border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base font-bold">
                SPS On-Grid Power Flow & DC Load Sharing (−48 VDC)
              </CardTitle>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>
            <CardDescription className="text-xs mt-0.5">
              Site: <span className="font-semibold text-slate-700 dark:text-slate-300">{siteSlug}</span> | Konfigurasi:{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {data?.site_config?.site_type || "TYPE_A"} ({data?.site_config?.pv_capacity_kwp || 5.85} kWp)
              </span>
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                pf?.load_sharing_active
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                  : "border-amber-500 text-amber-600 dark:text-amber-400"
              }
            >
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              {pf?.load_sharing_active ? `Load Sharing Aktif (ΔV +${pf?.voltage_delta_v.toFixed(1)}V)` : "Standby"}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSldOpen(true)}
              className="text-xs h-8 gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Eye className="h-3.5 w-3.5" />
              Buka SLD Diagram
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Top Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-500 block">Solar Contribution Ratio</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {data?.solar_contribution_pct.toFixed(1) || 0}%
              </span>
              <span className="text-[10px] text-slate-400 block">Beban DC ditopang surya</span>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-500 block">Performance Ratio (PR)</span>
              <span className="text-lg font-bold text-sky-600 dark:text-sky-400">
                {data?.performance_ratio_pct.toFixed(1) || 0}%
              </span>
              <span className="text-[10px] text-slate-400 block">Efisiensi output vs iradiasi</span>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-500 block">Total Beban Menara (BTS)</span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {((pf?.p_load || 0) / 1000).toFixed(2)} kW
              </span>
              <span className="text-[10px] text-slate-400 block">Konsumsi tenant aktual</span>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-500 block">Penghematan Hari Ini</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                Rp {(data?.pln_cost_avoided_idr || 0).toLocaleString("id-ID")}
              </span>
              <span className="text-[10px] text-slate-400 block">{data?.solar_kwh.toFixed(1) || 0} kWh PLN dihindari</span>
            </div>
          </div>

          {/* Interactive Flow Architecture */}
          <div className="relative p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-linear-to-br from-slate-50/80 to-slate-100/50 dark:from-slate-950/80 dark:to-slate-900/60 overflow-x-auto">
            <div className="min-w-[700px] flex items-center justify-between gap-3">
              {/* PV Array Node */}
              <div className="flex-1 rounded-xl p-3 border-2 border-amber-400/60 bg-white dark:bg-slate-900 shadow-sm relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                    <Sun className="h-4 w-4" />
                    <span>PV ARRAY</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">{pf?.irradiance.toFixed(0)} W/m²</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {((pf?.p_pv || 0) / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-500">kW</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
                  <div className="flex justify-between"><span>Tegangan:</span> <strong className="text-slate-700 dark:text-slate-300">{pf?.v_pv.toFixed(1)} V</strong></div>
                  <div className="flex justify-between"><span>Arus DC:</span> <strong className="text-slate-700 dark:text-slate-300">{pf?.i_pv.toFixed(1)} A</strong></div>
                </div>
              </div>

              {/* Arrow PV -> MPPT */}
              <div className="flex flex-col items-center px-1">
                <span className="text-[9px] font-mono text-amber-500 font-semibold mb-0.5">DC IN</span>
                <div className="flex items-center text-amber-500 animate-pulse">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>

              {/* MPPT Controller Node */}
              <div className="flex-1 rounded-xl p-3 border-2 border-emerald-400/60 bg-white dark:bg-slate-900 shadow-sm relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs">
                    <Cpu className="h-4 w-4" />
                    <span>MPPT CONTROLLER</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">{pf?.temp_mppt.toFixed(1)}°C</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {((pf?.p_mppt_out || 0) / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-500">kW</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
                  <div className="flex justify-between"><span>Output:</span> <strong className="text-emerald-600 dark:text-emerald-400">{pf?.v_mppt_out.toFixed(1)} V</strong></div>
                  <div className="flex justify-between"><span>Arus Suplai:</span> <strong className="text-slate-700 dark:text-slate-300">{pf?.i_mppt_out.toFixed(1)} A</strong></div>
                </div>
              </div>

              {/* Arrow MPPT -> Busbar */}
              <div className="flex flex-col items-center px-1">
                <span className="text-[9px] font-mono text-emerald-500 font-semibold mb-0.5">+ΔV</span>
                <div className="flex items-center text-emerald-500 animate-pulse">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>

              {/* Central DC Busbar & Rectifier PLN Section */}
              <div className="flex flex-col gap-2 flex-1">
                {/* DC Busbar Node */}
                <div className="rounded-xl p-3 border-2 border-teal-500/70 bg-teal-950/20 dark:bg-teal-950/30 text-teal-950 dark:text-teal-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-teal-600 dark:text-teal-400">DC BUSBAR (−48V)</span>
                    <span className="text-[10px] font-mono text-teal-700 dark:text-teal-300">{pf?.v_busbar.toFixed(1)} VDC</span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">
                    Prioritas beban surya: <span className="font-bold text-emerald-500">+{pf?.voltage_delta_v.toFixed(1)}V</span>
                  </div>
                </div>

                {/* Rectifier PLN Float Node */}
                <div className="rounded-xl p-2.5 border border-sky-400/50 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1 text-sky-500 font-semibold text-[11px]">
                      <Zap className="h-3.5 w-3.5" />
                      <span>RECTIFIER PLN</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{pf?.rectifier_float_voltage.toFixed(1)} V Float</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Suplai Sisa:</span>
                    <strong className="text-sky-600 dark:text-sky-400">{((pf?.p_rectifier || 0) / 1000).toFixed(2)} kW ({pf?.i_rectifier.toFixed(1)} A)</strong>
                  </div>
                </div>
              </div>

              {/* Arrow Busbar -> BTS Load */}
              <div className="flex flex-col items-center px-1">
                <span className="text-[9px] font-mono text-purple-500 font-semibold mb-0.5">TOTAL</span>
                <div className="flex items-center text-purple-500 animate-pulse">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>

              {/* BTS Tenant Load Node */}
              <div className="flex-1 rounded-xl p-3 border-2 border-purple-400/60 bg-white dark:bg-slate-900 shadow-sm relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-purple-500 font-bold text-xs">
                    <Radio className="h-4 w-4" />
                    <span>BEBAN TENANT BTS</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">Telco Tower</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {((pf?.p_load || 0) / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-500">kW</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
                  <div className="flex justify-between"><span>Surya:</span> <strong className="text-emerald-600 dark:text-emerald-400">{((pf?.p_mppt_out || 0) / 1000).toFixed(2)} kW</strong></div>
                  <div className="flex justify-between"><span>Grid PLN:</span> <strong className="text-sky-600 dark:text-sky-400">{((pf?.p_rectifier || 0) / 1000).toFixed(2)} kW</strong></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SingleLineDiagramModal
        open={sldOpen}
        onOpenChange={setSldOpen}
        siteSlug={siteSlug}
        siteType={data?.site_config?.site_type}
        powerFlow={pf}
      />
    </>
  )
}

