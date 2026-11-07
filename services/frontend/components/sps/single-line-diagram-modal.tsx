"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { SpsPowerFlow } from "@/lib/types"
import { Activity } from "lucide-react"

interface SingleLineDiagramModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteSlug: string
  siteType?: string
  powerFlow?: SpsPowerFlow
}

export default function SingleLineDiagramModal({
  open,
  onOpenChange,
  siteSlug,
  siteType = "TYPE_A",
  powerFlow,
}: SingleLineDiagramModalProps) {
  const pf = {
    irradiance: Number(powerFlow?.irradiance ?? 0),
    v_pv: Number(powerFlow?.v_pv ?? 0),
    i_pv: Number(powerFlow?.i_pv ?? 0),
    p_pv: Number(powerFlow?.p_pv ?? 0),
    v_mppt_out: Number(powerFlow?.v_mppt_out ?? 0),
    i_mppt_out: Number(powerFlow?.i_mppt_out ?? 0),
    p_mppt_out: Number(powerFlow?.p_mppt_out ?? 0),
    v_busbar: Number(powerFlow?.v_busbar ?? 53.5),
    i_rectifier: Number(powerFlow?.i_rectifier ?? 0),
    p_rectifier: Number(powerFlow?.p_rectifier ?? 0),
    p_load: Number(powerFlow?.p_load ?? 0),
    temp_mppt: Number(powerFlow?.temp_mppt ?? 0),
    rectifier_float_voltage: Number(powerFlow?.rectifier_float_voltage ?? 53.5),
    voltage_delta_v: Number(powerFlow?.voltage_delta_v ?? 0),
    load_sharing_active: Boolean(powerFlow?.load_sharing_active),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 text-slate-100 border-slate-800">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                <Activity className="h-5 w-5 text-emerald-400" />
                Single Line Diagram (SLD) — SPS On-Grid DC Coupling
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-1">
                Site: <span className="text-slate-200 font-semibold">{siteSlug}</span> | Konfigurasi:{" "}
                <span className="text-emerald-400 font-semibold">{siteType}</span> | Standar RKS Mitratel (−48 VDC)
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={
                pf.load_sharing_active
                  ? "border-emerald-500 text-emerald-400 bg-emerald-950/40"
                  : "border-amber-500 text-amber-400"
              }
            >
              {pf.load_sharing_active ? "Load Sharing Aktif (ΔV +0.5V s/d +1.0V)" : "Load Sharing Idle"}
            </Badge>
          </div>
        </DialogHeader>

        {/* Electrical Schematic Canvas */}
        <div className="relative rounded-xl border border-slate-800 bg-slate-900/80 p-6 my-2 shadow-inner">
          <svg className="w-full h-80" viewBox="0 0 800 320" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <linearGradient id="busbarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <rect width="800" height="320" fill="url(#grid)" />

            {/* PV Array Block */}
            <rect x="40" y="40" width="140" height="90" rx="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
            <text x="110" y="70" fill="#fcd34d" fontSize="13" fontWeight="bold" textAnchor="middle">
              PV ARRAY
            </text>
            <text x="110" y="90" fill="#94a3b8" fontSize="11" textAnchor="middle">
              {pf.p_pv.toFixed(0)} W | {pf.v_pv.toFixed(1)} V
            </text>
            <text x="110" y="110" fill="#64748b" fontSize="10" textAnchor="middle">
              I: {pf.i_pv.toFixed(1)} A
            </text>

            {/* Line PV -> MPPT */}
            <path d="M 180 85 L 260 85" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 3" />
            <polygon points="260,80 270,85 260,90" fill="#f59e0b" />

            {/* MPPT Controller Block */}
            <rect x="270" y="40" width="150" height="90" rx="8" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
            <text x="345" y="70" fill="#6ee7b7" fontSize="13" fontWeight="bold" textAnchor="middle">
              MPPT CONTROLLER
            </text>
            <text x="345" y="90" fill="#94a3b8" fontSize="11" textAnchor="middle">
              {pf.p_mppt_out.toFixed(0)} W | {pf.v_mppt_out.toFixed(1)} V
            </text>
            <text x="345" y="110" fill="#34d399" fontSize="10" textAnchor="middle">
              Output: {pf.i_mppt_out.toFixed(1)} A
            </text>

            {/* Line MPPT -> DC Busbar */}
            <path d="M 420 85 L 490 85" stroke="#10b981" strokeWidth="3" />
            <polygon points="490,80 500,85 490,90" fill="#10b981" />

            {/* Rectifier PLN Block */}
            <rect x="270" y="180" width="150" height="90" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="345" y="210" fill="#7dd3fc" fontSize="13" fontWeight="bold" textAnchor="middle">
              RECTIFIER PLN
            </text>
            <text x="345" y="230" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Float: {pf.rectifier_float_voltage.toFixed(1)} V
            </text>
            <text x="345" y="250" fill="#38bdf8" fontSize="10" textAnchor="middle">
              {pf.p_rectifier.toFixed(0)} W | {pf.i_rectifier.toFixed(1)} A
            </text>

            {/* Line Rectifier -> DC Busbar */}
            <path d="M 420 225 L 500 225" stroke="#38bdf8" strokeWidth="3" />
            <polygon points="490,220 500,225 490,230" fill="#38bdf8" />

            {/* DC Busbar (-48 VDC) - Heavy Vertical Bar */}
            <rect x="500" y="30" width="16" height="250" rx="4" fill="url(#busbarGrad)" stroke="#34d399" strokeWidth="1" />
            <text x="508" y="295" fill="#a7f3d0" fontSize="10" fontWeight="bold" textAnchor="middle">
              DC BUSBAR
            </text>
            <text x="508" y="310" fill="#6ee7b7" fontSize="9" textAnchor="middle">
              −48 VDC
            </text>

            {/* Line Busbar -> BTS Load */}
            <path d="M 516 155 L 610 155" stroke="#a855f7" strokeWidth="4" />
            <polygon points="610,149 622,155 610,161" fill="#a855f7" />

            {/* Tenant Load Block */}
            <rect x="622" y="110" width="150" height="90" rx="8" fill="#1e293b" stroke="#c084fc" strokeWidth="2" />
            <text x="697" y="140" fill="#e9d5ff" fontSize="13" fontWeight="bold" textAnchor="middle">
              BEBAN TENANT BTS
            </text>
            <text x="697" y="160" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Total: {pf.p_load.toFixed(0)} W
            </text>
            <text x="697" y="180" fill="#c084fc" fontSize="10" textAnchor="middle">
              Menara 4G / 5G
            </text>
          </svg>
        </div>

        {/* Technical Specification Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
            <span className="text-slate-400 font-medium">Prioritas Suplai Surya:</span>
            <p className="mt-1 text-slate-200">
              MPPT disetel <strong className="text-emerald-400">+{pf.voltage_delta_v.toFixed(1)}V</strong> di atas tegangan float rectifier ({pf.rectifier_float_voltage.toFixed(1)} V), sehingga energi surya diserap penuh terlebih dahulu.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
            <span className="text-slate-400 font-medium">Proteksi Reverse Current:</span>
            <p className="mt-1 text-slate-200">
              Dilengkapi dioda blocking internal & circuit breaker DC terpisah untuk mencegah aliran balik arus ke modul PV dan rectifier PLN.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
            <span className="text-slate-400 font-medium">Topologi DC-Coupled:</span>
            <p className="mt-1 text-slate-200">
              Tanpa baterai khusus solar (Zero Battery CAPEX), terhubung langsung ke DC Busbar eksisting site telekomunikasi.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
