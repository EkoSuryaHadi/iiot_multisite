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
  site_type?: string | null
  pv_capacity_kwp?: number | null
  mppt_capacity_a?: number | null
  rectifier_float_voltage?: number | null
  baseline_kwh_daily?: number | null
  latitude?: number | null
  longitude?: number | null
  tower_type?: string | null
  created_at: string
}

export interface Device {
  id: string
  tenant_id: string
  site_id: string
  device_key: string
  name: string
  is_active: boolean
  registration_status?: "active" | "pending"
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

export type AlarmSeverity = "critical" | "warning" | "info"

export interface AlarmItem {
  id: string
  title: string
  message: string
  severity: AlarmSeverity
  source: string
  metric_name?: string
  value?: number
  threshold?: number
  timestamp: string
}

// --- Mitratel SPS On-Grid (GTaaS) Types ---
export interface SpsPowerFlow {
  irradiance: number
  v_pv: number
  i_pv: number
  p_pv: number
  v_mppt_out: number
  i_mppt_out: number
  p_mppt_out: number
  v_busbar: number
  i_rectifier: number
  p_rectifier: number
  p_load: number
  temp_mppt: number
  rectifier_float_voltage: number
  voltage_delta_v: number
  load_sharing_active: boolean
}

export interface SpsPerformanceResponse {
  tenant_slug: string
  site_slug: string
  site_config: {
    site_type: string
    pv_capacity_kwp: number
    mppt_capacity_a: number
    rectifier_float_voltage: number
    baseline_kwh_daily: number
  }
  solar_kwh: number
  grid_kwh: number
  load_kwh: number
  solar_contribution_pct: number
  performance_ratio_pct: number
  pln_cost_avoided_idr: number
  carbon_avoided_kg: number
  trees_equivalent: number
  power_flow: SpsPowerFlow
}

export interface SpsPvHealth {
  health_index: number
  status: "HEALTHY" | "WARNING" | "DEGRADED"
  performance_ratio_pct: number
  string_anomaly: boolean
  max_string_deviation_pct: number
  string_currents: number[]
}

export interface SpsMpptHealth {
  health_index: number
  status: "HEALTHY" | "WARNING" | "CRITICAL"
  efficiency_pct: number
  is_efficiency_ok: boolean
  temp_mppt_c: number
  is_temperature_ok: boolean
  voltage_delta_v: number | null
  load_sharing_active: boolean
}

export interface SpsHealthResponse {
  tenant_slug: string
  site_slug: string
  site_health_index: number
  status: "HEALTHY" | "WARNING" | "CRITICAL" | "DEGRADED"
  pv_health: SpsPvHealth
  mppt_health: SpsMpptHealth
}

export interface SpsDailyEnergyRecord {
  date: string
  solar_kwh: number
  grid_kwh: number
  load_kwh: number
  solar_contribution_pct: number
  performance_ratio_pct: number
  updated_at: string
}

export interface SpsDailyEnergyResponse {
  tenant_slug: string
  site_slug: string
  records: SpsDailyEnergyRecord[]
  total: number
}
