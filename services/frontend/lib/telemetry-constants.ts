export interface MetricConfig {
  key: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  warningThreshold: number;
  criticalThreshold: number;
  category: "environment" | "electrical" | "mechanical" | "general";
}

export const COMMON_METRICS: MetricConfig[] = [
  {
    key: "temp",
    name: "Temperature",
    unit: "°C",
    min: 0,
    max: 100,
    warningThreshold: 45,
    criticalThreshold: 60,
    category: "environment",
  },
  {
    key: "temperature",
    name: "Temperature",
    unit: "°C",
    min: 0,
    max: 100,
    warningThreshold: 45,
    criticalThreshold: 60,
    category: "environment",
  },
  {
    key: "humidity",
    name: "Humidity",
    unit: "%RH",
    min: 0,
    max: 100,
    warningThreshold: 75,
    criticalThreshold: 85,
    category: "environment",
  },
  {
    key: "voltage",
    name: "Voltage",
    unit: "V",
    min: 0,
    max: 300,
    warningThreshold: 245,
    criticalThreshold: 260,
    category: "electrical",
  },
  {
    key: "current",
    name: "Current",
    unit: "A",
    min: 0,
    max: 50,
    warningThreshold: 32,
    criticalThreshold: 40,
    category: "electrical",
  },
  {
    key: "power",
    name: "Active Power",
    unit: "kW",
    min: 0,
    max: 30,
    warningThreshold: 20,
    criticalThreshold: 25,
    category: "electrical",
  },
  {
    key: "energy",
    name: "Total Energy",
    unit: "kWh",
    min: 0,
    max: 1000,
    warningThreshold: 800,
    criticalThreshold: 950,
    category: "electrical",
  },
  {
    key: "pressure",
    name: "Pressure",
    unit: "bar",
    min: 0,
    max: 16,
    warningThreshold: 10,
    criticalThreshold: 13,
    category: "mechanical",
  },
  {
    key: "vibration",
    name: "Vibration",
    unit: "mm/s",
    min: 0,
    max: 15,
    warningThreshold: 4.5,
    criticalThreshold: 7.1,
    category: "mechanical",
  },
  {
    key: "flow_rate",
    name: "Flow Rate",
    unit: "L/min",
    min: 0,
    max: 150,
    warningThreshold: 110,
    criticalThreshold: 130,
    category: "mechanical",
  },
  {
    key: "rpm",
    name: "Speed (RPM)",
    unit: "RPM",
    min: 0,
    max: 4000,
    warningThreshold: 3200,
    criticalThreshold: 3600,
    category: "mechanical",
  },
  // --- SPS On-Grid (Solar & Power Flow) ---
  {
    key: "pv_power",
    name: "PV Array Power",
    unit: "kW",
    min: 0,
    max: 20,
    warningThreshold: 15,
    criticalThreshold: 18,
    category: "electrical",
  },
  {
    key: "pv_voltage",
    name: "PV Array Voltage",
    unit: "V",
    min: 0,
    max: 300,
    warningThreshold: 240,
    criticalThreshold: 260,
    category: "electrical",
  },
  {
    key: "pv_current",
    name: "PV Array Current",
    unit: "A",
    min: 0,
    max: 80,
    warningThreshold: 60,
    criticalThreshold: 75,
    category: "electrical",
  },
  {
    key: "mppt_current",
    name: "MPPT Output Current",
    unit: "A",
    min: 0,
    max: 120,
    warningThreshold: 90,
    criticalThreshold: 110,
    category: "electrical",
  },
  {
    key: "rectifier_voltage",
    name: "Rectifier Float Voltage",
    unit: "V",
    min: 40,
    max: 65,
    warningThreshold: 56,
    criticalThreshold: 59,
    category: "electrical",
  },
  {
    key: "irradiance",
    name: "Solar Irradiance",
    unit: "W/m²",
    min: 0,
    max: 1200,
    warningThreshold: 1000,
    criticalThreshold: 1150,
    category: "environment",
  },
];

export function getMetricConfig(metricKey: string): MetricConfig {
  const normalized = metricKey.trim().toLowerCase();
  const match = COMMON_METRICS.find((m) => m.key.toLowerCase() === normalized);
  if (match) return match;

  // Heuristic fallbacks
  if (normalized.includes("temp")) {
    return {
      key: metricKey,
      name: "Temperature",
      unit: "°C",
      min: 0,
      max: 100,
      warningThreshold: 45,
      criticalThreshold: 60,
      category: "environment",
    };
  }
  if (normalized.includes("irrad") || normalized.includes("solar_rad")) {
    return {
      key: metricKey,
      name: "Solar Irradiance",
      unit: "W/m²",
      min: 0,
      max: 1200,
      warningThreshold: 1000,
      criticalThreshold: 1150,
      category: "environment",
    };
  }
  if (normalized.includes("volt")) {
    return {
      key: metricKey,
      name: "Voltage",
      unit: "V",
      min: 0,
      max: 300,
      warningThreshold: 245,
      criticalThreshold: 260,
      category: "electrical",
    };
  }
  if (normalized.includes("curr") || normalized.includes("amp")) {
    return {
      key: metricKey,
      name: "Current",
      unit: "A",
      min: 0,
      max: 50,
      warningThreshold: 32,
      criticalThreshold: 40,
      category: "electrical",
    };
  }
  if (normalized.includes("power") || normalized.includes("watt") || normalized.includes("kw")) {
    return {
      key: metricKey,
      name: "Power",
      unit: "kW",
      min: 0,
      max: 30,
      warningThreshold: 22,
      criticalThreshold: 28,
      category: "electrical",
    };
  }
  if (normalized.includes("energy") || normalized.includes("kwh")) {
    return {
      key: metricKey,
      name: "Energy",
      unit: "kWh",
      min: 0,
      max: 1000,
      warningThreshold: 800,
      criticalThreshold: 950,
      category: "electrical",
    };
  }
  if (normalized.includes("press")) {
    return {
      key: metricKey,
      name: "Pressure",
      unit: "bar",
      min: 0,
      max: 16,
      warningThreshold: 10,
      criticalThreshold: 13,
      category: "mechanical",
    };
  }

  // Generic fallback
  return {
    key: metricKey,
    name: metricKey,
    unit: "",
    min: 0,
    max: 100,
    warningThreshold: 75,
    criticalThreshold: 90,
    category: "general",
  };
}

export interface TimePreset {
  label: string;
  durationMinutes: number;
  recommendedInterval: "raw" | "1m" | "1h";
}

export const TIME_PRESETS: TimePreset[] = [
  { label: "15m", durationMinutes: 15, recommendedInterval: "raw" },
  { label: "1h", durationMinutes: 60, recommendedInterval: "raw" },
  { label: "6h", durationMinutes: 360, recommendedInterval: "1m" },
  { label: "24h", durationMinutes: 1440, recommendedInterval: "1m" },
  { label: "7d", durationMinutes: 10080, recommendedInterval: "1h" },
];
