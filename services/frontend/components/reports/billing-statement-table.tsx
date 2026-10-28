"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Printer, FileSpreadsheet } from "lucide-react"
import type { SpsDailyEnergyRecord } from "@/lib/types"

interface BillingStatementTableProps {
  siteSlug: string
  records: SpsDailyEnergyRecord[]
  sharingRatioPct?: number // Rasio bagi hasil, default 50%
  plnTariffIdr?: number // Tarif PLN default Rp 1.444,70 / kWh
}

export default function BillingStatementTable({
  siteSlug,
  records,
  sharingRatioPct = 50.0,
  plnTariffIdr = 1444.70,
}: BillingStatementTableProps) {
  // Hitung total ringkasan
  const totalSolarKwh = records.reduce((acc, r) => acc + r.solar_kwh, 0)
  const totalGridKwh = records.reduce((acc, r) => acc + r.grid_kwh, 0)
  const totalLoadKwh = records.reduce((acc, r) => acc + r.load_kwh, 0)
  const avgScr =
    records.length > 0
      ? records.reduce((acc, r) => acc + r.solar_contribution_pct, 0) / records.length
      : 0
  const totalCostAvoided = Math.round(totalSolarKwh * plnTariffIdr)
  const mitratelShare = Math.round(totalCostAvoided * (sharingRatioPct / 100))
  const tenantShare = totalCostAvoided - mitratelShare

  const handleExportCsv = () => {
    const headers = [
      "Tanggal",
      "Solar kWh",
      "Grid PLN kWh",
      "Beban Total kWh",
      "SCR (%)",
      "PR (%)",
      "Penghematan PLN (Rp)",
      `Porsi Mitratel (${sharingRatioPct}%)`,
      `Porsi Tenant (${100 - sharingRatioPct}%)`,
    ]
    const rows = records.map((r) => {
      const avoided = Math.round(r.solar_kwh * plnTariffIdr)
      const mShare = Math.round(avoided * (sharingRatioPct / 100))
      const tShare = avoided - mShare
      return [
        r.date,
        r.solar_kwh.toFixed(2),
        r.grid_kwh.toFixed(2),
        r.load_kwh.toFixed(2),
        r.solar_contribution_pct.toFixed(2),
        r.performance_ratio_pct.toFixed(2),
        avoided,
        mShare,
        tShare,
      ].join(",")
    })
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `efficiency_sharing_${siteSlug}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons & Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm print:hidden">
        <div>
          <span className="text-xs text-slate-500 block">Total Penghematan Efisiensi (Bulan Berjalan):</span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            Rp {totalCostAvoided.toLocaleString("id-ID")}
          </span>
          <span className="text-xs text-slate-400 block mt-0.5">
            Mitratel: Rp {mitratelShare.toLocaleString("id-ID")} ({sharingRatioPct}%) | Tenant: Rp {tenantShare.toLocaleString("id-ID")} ({100 - sharingRatioPct}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5 text-xs h-9">
            <Download className="h-3.5 w-3.5" />
            Ekspor CSV / Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-9">
            <Printer className="h-3.5 w-3.5" />
            Cetak PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
            <TableRow>
              <TableHead className="font-semibold text-xs">Tanggal</TableHead>
              <TableHead className="font-semibold text-xs text-right">Solar (kWh)</TableHead>
              <TableHead className="font-semibold text-xs text-right">PLN Grid (kWh)</TableHead>
              <TableHead className="font-semibold text-xs text-right">Total Beban (kWh)</TableHead>
              <TableHead className="font-semibold text-xs text-right">SCR (%)</TableHead>
              <TableHead className="font-semibold text-xs text-right">PR (%)</TableHead>
              <TableHead className="font-semibold text-xs text-right">Penghematan PLN (Rp)</TableHead>
              <TableHead className="font-semibold text-xs text-right">Sharing Mitratel (Rp)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-500 text-xs">
                  Belum ada rekonsiliasi data harian untuk rentang waktu ini.
                </TableCell>
              </TableRow>
            ) : (
              records.map((r, idx) => {
                const avoided = Math.round(r.solar_kwh * plnTariffIdr)
                const mShare = Math.round(avoided * (sharingRatioPct / 100))
                return (
                  <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-xs font-mono">
                    <TableCell className="font-medium font-sans">{r.date}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      {r.solar_kwh.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-slate-600 dark:text-slate-400">
                      {r.grid_kwh.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-slate-800 dark:text-slate-200">
                      {r.load_kwh.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px] font-sans border-emerald-400/50 text-emerald-600 dark:text-emerald-400">
                        {r.solar_contribution_pct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sky-600 dark:text-sky-400">
                      {r.performance_ratio_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-sans font-semibold">
                      Rp {avoided.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right font-sans font-semibold text-emerald-600 dark:text-emerald-400">
                      Rp {mShare.toLocaleString("id-ID")}
                    </TableCell>
                  </TableRow>
                )
              })
            )}

            {/* Total Row */}
            {records.length > 0 && (
              <TableRow className="bg-slate-100/70 dark:bg-slate-800/60 font-bold text-xs">
                <TableCell className="font-sans">TOTAL / RATA-RATA</TableCell>
                <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                  {totalSolarKwh.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-slate-600 dark:text-slate-400">
                  {totalGridKwh.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-slate-800 dark:text-slate-200">
                  {totalLoadKwh.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="text-[10px] font-sans border-emerald-500 text-emerald-600 dark:text-emerald-400">
                    {avgScr.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right font-sans">
                  Rp {totalCostAvoided.toLocaleString("id-ID")}
                </TableCell>
                <TableCell className="text-right font-sans text-emerald-600 dark:text-emerald-400">
                  Rp {mitratelShare.toLocaleString("id-ID")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
