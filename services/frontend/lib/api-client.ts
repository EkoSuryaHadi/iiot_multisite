import type {
  AppUser,
  Device,
  DeviceCredential,
  DeviceStatusListResponse,
  Site,
  SiteSummary,
  Tenant,
  TelemetryResponse,
  TenantSummary,
  UserRole,
} from "@/lib/types"

export class ApiRequestError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type QueryParams = Record<string, string | number | boolean | undefined | null>

function buildQuery(params?: QueryParams): string {
  if (!params) return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  })

  if (!resp.ok) {
    let message = `Request gagal (${resp.status})`
    try {
      const body = await resp.json()
      if (typeof body.detail === "string") message = body.detail
      else if (Array.isArray(body.detail)) {
        message = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ") || message
      }
    } catch {
      // body bukan JSON, pakai pesan default
    }
    throw new ApiRequestError(resp.status, message)
  }

  if (resp.status === 204) return undefined as T
  const text = await resp.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const dm = {
  get: <T>(path: string, params?: QueryParams) => request<T>(`/api/bff/device-mgmt${path}${buildQuery(params)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(`/api/bff/device-mgmt${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(`/api/bff/device-mgmt${path}`, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(`/api/bff/device-mgmt${path}`, { method: "DELETE" }),
}

const an = {
  get: <T>(path: string, params?: QueryParams) => request<T>(`/api/bff/analytics${path}${buildQuery(params)}`),
}

// --- Tenants (superadmin only di backend) ---
export const tenantsApi = {
  list: () => dm.get<Tenant[]>("/tenants"),
  create: (data: { slug: string; name: string }) => dm.post<Tenant>("/tenants", data),
  update: (id: string, data: { name?: string; is_active?: boolean }) => dm.patch<Tenant>(`/tenants/${id}`, data),
  remove: (id: string) => dm.delete<void>(`/tenants/${id}`),
}

// --- Sites ---
export const sitesApi = {
  list: () => dm.get<Site[]>("/sites"),
  create: (data: { slug: string; name: string; tenant_id?: string }) => dm.post<Site>("/sites", data),
  update: (id: string, data: { name?: string; is_active?: boolean }) => dm.patch<Site>(`/sites/${id}`, data),
  remove: (id: string) => dm.delete<void>(`/sites/${id}`),
}

// --- Devices ---
export const devicesApi = {
  list: () => dm.get<Device[]>("/devices"),
  listPending: () => dm.get<Device[]>("/devices/pending"),
  create: (data: { device_key: string; name: string; site_id: string; tenant_id?: string }) =>
    dm.post<Device>("/devices", data),
  claim: (id: string, data: { name: string; site_id: string; tenant_id?: string }) =>
    dm.post<Device>(`/devices/${id}/claim`, data),
  update: (id: string, data: { name?: string; is_active?: boolean }) => dm.patch<Device>(`/devices/${id}`, data),
  remove: (id: string) => dm.delete<void>(`/devices/${id}`),
  provisionCredentials: (id: string) => dm.post<DeviceCredential>(`/devices/${id}/credentials`),
}

// --- Users ---
export const usersApi = {
  list: () => dm.get<AppUser[]>("/users"),
  create: (data: { email: string; password: string; role: UserRole; tenant_id?: string }) =>
    dm.post<AppUser>("/users", data),
  update: (id: string, data: { password?: string; role?: UserRole; is_active?: boolean }) =>
    dm.patch<AppUser>(`/users/${id}`, data),
  remove: (id: string) => dm.delete<void>(`/users/${id}`),
}

// --- Analytics ---
export const analyticsApi = {
  getTelemetry: (params: {
    device_key: string
    metric_name: string
    start: string
    end: string
    site_slug?: string
    tenant_slug?: string
    interval?: "raw" | "1m" | "1h"
    limit?: number
    offset?: number
  }) => an.get<TelemetryResponse>("/telemetry", params),

  getDevicesStatus: (params?: {
    site_slug?: string
    tenant_slug?: string
    online_threshold_seconds?: number
    limit?: number
    offset?: number
  }) => an.get<DeviceStatusListResponse>("/devices/status", params),

  getSummaryTenant: (params?: { tenant_slug?: string; start?: string; end?: string }) =>
    an.get<TenantSummary>("/summary/tenant", params),

  getSummarySite: (params: { site_slug: string; tenant_slug?: string; start?: string; end?: string }) =>
    an.get<SiteSummary>("/summary/site", params),
}
