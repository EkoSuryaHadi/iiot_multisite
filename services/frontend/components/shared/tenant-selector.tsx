"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTenantContext } from "@/contexts/TenantContext"

/** Dropdown pemilih tenant - hanya tampil untuk superadmin, karena role lain
 * selalu otomatis di-scope ke tenant miliknya sendiri oleh backend. */
export default function TenantSelector() {
  const { isSuperadmin, tenants, tenantsLoading, selectedTenant, setSelectedTenantId } = useTenantContext()

  if (!isSuperadmin) return null

  return (
    <Select
      value={selectedTenant?.id}
      onValueChange={setSelectedTenantId}
      disabled={tenantsLoading || tenants.length === 0}
    >
      <SelectTrigger className="w-[220px] bg-white dark:bg-slate-800">
        <SelectValue placeholder={tenantsLoading ? "Memuat tenant..." : "Pilih tenant"} />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((tenant) => (
          <SelectItem key={tenant.id} value={tenant.id}>
            {tenant.name} ({tenant.slug})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
