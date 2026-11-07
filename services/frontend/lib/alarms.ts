import type { AlarmItem, DeviceStatusItem, MetricSummary } from "./types";

export interface ThresholdRule {
  metricPattern: RegExp;
  criticalMax?: number;
  criticalMin?: number;
  warningMax?: number;
  warningMin?: number;
  unit: string;
}

// Default standard rules for common industrial metrics
export const DEFAULT_THRESHOLD_RULES: ThresholdRule[] = [
  {
    metricPattern: /(temp|temperature|suhu)/i,
    warningMax: 70,
    criticalMax: 85,
    unit: "°C",
  },
  {
    metricPattern: /(volt|voltage|tegangan)/i,
    criticalMin: 180,
    warningMin: 200,
    warningMax: 240,
    criticalMax: 250,
    unit: "V",
  },
  {
    metricPattern: /(pressure|tekanan|bar)/i,
    warningMax: 8,
    criticalMax: 10,
    unit: "bar",
  },
  {
    metricPattern: /(vibrat|vibration|getaran)/i,
    warningMax: 4.5,
    criticalMax: 7.0,
    unit: "mm/s",
  },
];

/**
 * Evaluate metrics and device statuses to produce active alarm items
 */
export function evaluateAlarms({
  devices = [],
  metrics = [],
}: {
  devices?: DeviceStatusItem[];
  metrics?: MetricSummary[];
}): AlarmItem[] {
  const alarms: AlarmItem[] = [];

  // 1. Evaluate offline devices
  devices.forEach((d) => {
    if (d.status === "offline") {
      alarms.push({
        id: `offline-${d.site_slug}-${d.device_key}`,
        title: `Device Offline: ${d.device_key}`,
        message: `Perangkat di site ${d.site_slug} tidak mengirim telemetry.`,
        severity: "critical",
        source: d.device_key,
        timestamp: d.last_seen || new Date().toISOString(),
      });
    }
  });

  // 2. Evaluate metric thresholds
  metrics.forEach((m) => {
    const matchedRule = DEFAULT_THRESHOLD_RULES.find((rule) =>
      rule.metricPattern.test(m.metric_name)
    );

    if (matchedRule) {
      if (matchedRule.criticalMax !== undefined && m.max >= matchedRule.criticalMax) {
        alarms.push({
          id: `crit-max-${m.metric_name}`,
          title: `Batas Kritis: ${m.metric_name.toUpperCase()}`,
          message: `Nilai maksimum ${m.max.toFixed(1)}${matchedRule.unit} melampaui ambang kritis (${matchedRule.criticalMax}${matchedRule.unit}).`,
          severity: "critical",
          source: m.metric_name,
          metric_name: m.metric_name,
          value: m.max,
          threshold: matchedRule.criticalMax,
          timestamp: new Date().toISOString(),
        });
      } else if (matchedRule.warningMax !== undefined && m.max >= matchedRule.warningMax) {
        alarms.push({
          id: `warn-max-${m.metric_name}`,
          title: `Peringatan: ${m.metric_name.toUpperCase()}`,
          message: `Nilai maksimum ${m.max.toFixed(1)}${matchedRule.unit} mendekati batas toleransi (${matchedRule.warningMax}${matchedRule.unit}).`,
          severity: "warning",
          source: m.metric_name,
          metric_name: m.metric_name,
          value: m.max,
          threshold: matchedRule.warningMax,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  return alarms;
}
