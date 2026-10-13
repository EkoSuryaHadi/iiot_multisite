export type UserRole = "superadmin" | "tenant_admin" | "operator" | "viewer"

export interface Tenant {
  id: string
  slug: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Site {
  id: string
  tenant_id: string
  slug: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Device {
  id: string
  tenant_id: string
  site_id: string
  device_key: string
  name: string
  is_active: boolean
  created_at: string
}

export interface DeviceCredential {
  client_id: string
  password: string
  mqtt_topic_prefix: string
}

export interface AppUser {
  id: string
  tenant_id: string | null
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TelemetryPoint {
  ts: string
  value?: number | null
  avg?: number | null
  min?: number | null
  max?: number | null
  count?: number | null
}

export interface TelemetryResponse {
  tenant_slug: string
  site_slug?: string | null
  device_key: string
  metric_name: string
  interval: "raw" | "1m" | "1h"
  limit: number
  offset: number
  has_more: boolean
  points: TelemetryPoint[]
}

export interface DeviceStatusItem {
  tenant_slug: string
  site_slug: string
  device_key: string
  status: "online" | "offline"
  last_seen: string
}

export interface DeviceStatusListResponse {
  limit: number
  offset: number
  has_more: boolean
  devices: DeviceStatusItem[]
}

export interface MetricSummary {
  metric_name: string
  avg: number
  min: number
  max: number
  count: number
}

export interface TenantSummary {
  tenant_slug: string
  device_count: number
  online_count: number
  offline_count: number
  metrics: MetricSummary[]
}

export interface SiteSummary extends TenantSummary {
  site_slug: string
}

export interface ApiError {
  detail: string | { msg: string }[]
}
