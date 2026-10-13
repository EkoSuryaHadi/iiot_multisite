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
  const { data: session } = useSession()
  const isSuperadmin = session?.user?.role === "superadmin"

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [selectedTenantId, setSelectedTenantId] = useState<string | undefined>(undefined)

  const refreshTenants = async () => {
    if (!isSuperadmin) return
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
    if (isSuperadmin) {
      refreshTenants()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin])

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) ?? null

  return (
    <TenantContext.Provider
      value={{
        isSuperadmin,
        tenants,
        tenantsLoading,
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
