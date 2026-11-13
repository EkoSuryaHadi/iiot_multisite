import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ClickHouse mengirim `ts` sebagai naive UTC ("2026-11-13 10:44:30.332") tanpa
// penanda zona. Tanpa penanda, new Date() mem-parse-nya sebagai waktu LOKAL,
// sehingga jam yang tampil = UTC (meleset 8 jam dari WITA) dan label
// "x menit lalu" juga meleset. Fungsi ini menandai string naive sebagai UTC.
export function parseTsUtc(ts: string | number | Date): Date {
  if (typeof ts !== "string") return new Date(ts)
  const s = ts.trim()
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s)
  return new Date(s.replace(" ", "T") + "Z")
}

// Format waktu dalam zona WIB (Asia/Jakarta, GMT+7) secara eksplisit —
// konsisten di semua perangkat, tidak tergantung timezone browser.
export function formatWita(ts: string | number | Date, withDate = true): string {
  const d = parseTsUtc(ts)
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...(withDate ? { day: "2-digit", month: "short", year: "numeric" } : {}),
  }
  return d.toLocaleString("id-ID", opts) + " WIB"
}
