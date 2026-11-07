"use client";

import React from "react";
import { 
  ArrowRight, 
  Cpu, 
  Database, 
  Layers, 
  Radio, 
  Server, 
  ShieldCheck, 
  Smartphone, 
  Terminal 
} from "lucide-react";

const PIPELINE_STEPS = [
  {
    step: "01",
    tag: "EDGE SENSORS & PLCS",
    title: "Field Devices & Gateways",
    detail: "Sensors, energy meters, and PLCs report 3-phase power, vibration, temperature, and RPM via Modbus/OPC-UA to edge gateway collectors.",
    tech: "Modbus TCP / RTU // OPC-UA",
  },
  {
    step: "02",
    tag: "INGESTION BROKER",
    title: "EMQX Distributed Cluster",
    detail: "High-concurrency MQTT broker handles millions of incoming telemetry topics with mTLS encryption and instant webhook client authentication.",
    tech: "MQTT v5.0 // Auth Webhook",
  },
  {
    step: "03",
    tag: "BUFFER & PIPELINE",
    title: "Analytics API Worker",
    detail: "Asynchronous memory buffer aggregates streaming telemetry packets into micro-batches with persistent retry queues during peak load.",
    tech: "FastAPI Async // Memory Buffer",
  },
  {
    step: "04",
    tag: "OLAP DATA ENGINE",
    title: "ClickHouse Timeseries",
    detail: "Columnar database partitioned by site & timestamp. Executes sub-second aggregations, rollups, and anomaly scans across billions of records.",
    tech: "ClickHouse // ReplacingMergeTree",
  },
  {
    step: "05",
    tag: "OPERATIONAL UI",
    title: "Multi-Site Web Console",
    detail: "Real-time dashboard provides line operators and plant managers with live charts, device health, and automated threshold alerts.",
    tech: "Next.js // ApexCharts // WebSockets",
  },
];

export default function LandingArchitecture() {
  return (
    <section id="architecture" className="w-full bg-zinc-50 dark:bg-zinc-900/60 py-20 px-4 sm:px-6 lg:px-8 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 mb-4">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            END-TO-END DATA PIPELINE
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-sans">
            How Telemetry Flows from Factory Floor to Dashboard
          </h2>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
            A battle-tested industrial telemetry architecture designed for low latency, fault tolerance, and zero packet loss.
          </p>
        </div>

        {/* Steps Pipeline Horizontal/Vertical */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {PIPELINE_STEPS.map((s, idx) => (
            <div 
              key={idx}
              className="relative p-5 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col justify-between group hover:border-zinc-500 dark:hover:border-zinc-600 transition-colors shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between mb-3 font-mono">
                  <span className="text-lg font-bold text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                    {s.step}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded">
                    {s.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2 font-sans">
                  {s.title}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {s.detail}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-900 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                {s.tech}
              </div>
            </div>
          ))}
        </div>

        {/* Technical Callout Box */}
        <div className="mt-12 p-6 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              FAULT-TOLERANT RETRY GUARANTEE
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
              If downstream ClickHouse maintenance or network partitioning occurs, the buffer tier queues events in memory and disk overflow to ensure zero data loss across all plant sites.
            </p>
          </div>
          <a
            href="/auth/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-xs font-mono font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors shrink-0"
          >
            Request Site Access &rarr;
          </a>
        </div>

      </div>
    </section>
  );
}
