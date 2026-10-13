"use client"

import type { UserRole } from "@/lib/types"
import { useSession } from "next-auth/react"
import { ReactNode } from "react"

/** Sembunyikan children kalau role user saat ini tidak termasuk `allow`.
 * Catatan: ini hanya pembatasan tampilan UI - penegakan akses sebenarnya tetap
 * dilakukan backend (403) untuk setiap endpoint yang relevan. */
export default function RoleGate({ allow, children }: { allow: UserRole[]; children: ReactNode }) {
  const { data: session } = useSession()
  const role = session?.user?.role
  if (!role || !allow.includes(role)) return null
  return <>{children}</>
}

export function useHasRole(allow: UserRole[]): boolean {
  const { data: session } = useSession()
  const role = session?.user?.role
  return !!role && allow.includes(role)
}
