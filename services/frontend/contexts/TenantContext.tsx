"use client"

import { tenantsApi } from "@/lib/api-client"
import type { Tenant } from "@/lib/types"
import { useSession } from "next-auth/react"
import { createContext, ReactNode, useContext, useEffect, useState } from "react"

interface TenantContextValue {
  isSuperadmin: boolean
  tenants: Tenant[]
  tenantsLoading: boolean
  selectedTenant: Tenant | null
  selectedTenantSlug: string | undefined
  setSelectedTenantId: (tenantId: string) => void
  refreshTenants: () => Promise<void>
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const isSessionLoading = status === "loading"
  const isRealSuperadmin = session?.user?.role === "superadmin"
  // Saat session masih loading, tahan komponen agar tidak menembak API tanpa tenant_slug
  const isSuperadmin = isSessionLoading ? true : isRealSuperadmin

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [selectedTenantId, setSelectedTenantId] = useState<string | undefined>(undefined)

  const refreshTenants = async () => {
    if (!isRealSuperadmin) return
    setTenantsLoading(true)
    try {
      const list = await tenantsApi.list()
      setTenants(list)
      setSelectedTenantId((prev) => prev ?? list[0]?.id)
    } finally {
      setTenantsLoading(false)
    }
  }

  useEffect(() => {
    if (isRealSuperadmin) {
      refreshTenants()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealSuperadmin])

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) ?? null

  return (
    <TenantContext.Provider
      value={{
        isSuperadmin,
        tenants,
        tenantsLoading: isSessionLoading || tenantsLoading,
        selectedTenant,
        selectedTenantSlug: selectedTenant?.slug,
        setSelectedTenantId,
        refreshTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error("useTenantContext must be used within TenantProvider")
  return ctx
}
