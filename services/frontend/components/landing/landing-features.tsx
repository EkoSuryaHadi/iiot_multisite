"use client";

import React from "react";
import { 
  BarChart3, 
  Cpu, 
  Database, 
  Factory, 
  Layers, 
  Network, 
  Radio, 
  ShieldCheck, 
  Terminal, 
  Zap 
} from "lucide-react";

const SPECS = [
  { label: "INGESTION LATENCY", value: "< 50ms", note: "Sub-second analytical commit" },
  { label: "MQTT THROUGHPUT", value: "100k+ msg/s", note: "Distributed EMQX v5 cluster" },
  { label: "STORAGE ENGINE", value: "ClickHouse OLAP", note: "Columnar ReplacingMergeTree" },
  { label: "BUFFER RELIABILITY", value: "Zero Loss", note: "Dual-tier fallback queue" },
];

const CAPABILITIES = [
  {
    icon: <Factory className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />,
    badge: "SITE TOPOLOGY",
    title: "Multi-Plant Hierarchical Modeling",
    description: "Map complex manufacturing operations seamlessly: Enterprise → Factory Sites → Production Lines → Machine Cells → Sensor Channels with strict tenant and RBAC boundaries.",
    points: ["Site-level multi-tenancy", "Granular machine status tracking", "Substation & line aggregation"],
  },
  {
    icon: <Database className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />,
    badge: "COLUMNAR STORAGE",
    title: "High-Throughput ClickHouse Engine",
    description: "Built on ClickHouse for lightning-fast aggregation queries over billions of telemetry rows. Calculate power factor averages, vibration trends, and runtime hours in milliseconds.",
    points: ["ReplacingMergeTree deduplication", "Partitioned by month & site", "Raw and aggregated rollups"],
  },
  {
    icon: <Radio className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />,
    badge: "EDGE PROTOCOLS",
    title: "EMQX MQTT & Industrial Gateways",
    description: "Bridge Modbus-RTU, Modbus-TCP, and OPC-UA devices through industrial edge gateways into an enterprise EMQX cluster with mutual TLS encryption and webhook authentication.",
    points: ["Dynamic device webhook auth", "Sub-millisecond packet routing", "Quality of Service (QoS 0/1/2)"],
  },
  {
    icon: <Zap className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />,
    badge: "CONDITION MONITORING",
    title: "Real-Time Anomaly & Threshold Alerts",
    description: "Continuously detect voltage dips, current harmonics, bearing temperature spikes, and ISO 10816 vibration thresholds before catastrophic mechanical failure strikes.",
    points: ["Instant webhook & email alerts", "Dynamic threshold calibration", "Downtime event logging"],
  },
];

export default function LandingFeatures() {
  return (
    <section id="capabilities" className="w-full bg-white dark:bg-zinc-950 py-20 px-4 sm:px-6 lg:px-8 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto">
        
        {/* Specs Strip */}
        <div id="specs" className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-16 border-b border-zinc-200 dark:border-zinc-800 font-mono">
          {SPECS.map((spec, i) => (
            <div key={i} className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider">{spec.label}</div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">{spec.value}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{spec.note}</div>
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className="mt-16 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 mb-4">
            <Terminal className="w-3.5 h-3.5" />
            CORE INFRASTRUCTURE
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-sans">
            Engineered for Industrial Scale &amp; Reliability
          </h2>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
            A production-grade telemetry pipeline purpose-built for plant managers, automation engineers, 
            and IIoT operations teams.
          </p>
        </div>

        {/* 4 Capabilities Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {CAPABILITIES.map((cap, idx) => (
            <div
              key={idx}
              className="group p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                  {cap.icon}
                </div>
                <span className="text-[10px] font-mono font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                  {cap.badge}
                </span>
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-sans">
                {cap.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {cap.description}
              </p>
              
              <ul className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2">
                {cap.points.map((pt, pIdx) => (
                  <li key={pIdx} className="flex items-center gap-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
