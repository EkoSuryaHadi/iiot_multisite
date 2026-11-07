"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Activity, 
  ArrowRight, 
  Cpu, 
  Flame, 
  Gauge, 
  Radio, 
  Server, 
  Zap 
} from "lucide-react";

const SITES_DATA = [
  {
    id: "site-cikarang",
    name: "Site 01 // Cikarang Plant",
    unit: "Line 4 - Hydraulic Stamping Press",
    status: "OPTIMAL",
    voltage: "401.4 V",
    current: "142.8 A",
    power: "82.6 kW",
    powerFactor: "0.94",
    vibration: "1.42 mm/s",
    temp: "63.8 °C",
    pressure: "18.4 bar",
    ingestRate: "3,840 msg/s",
    bufferLatency: "18ms",
  },
  {
    id: "site-karawang",
    name: "Site 02 // Karawang Facility",
    unit: "Main Substation & Compressor Bank",
    status: "STABLE",
    voltage: "399.8 V",
    current: "215.3 A",
    power: "128.4 kW",
    powerFactor: "0.96",
    vibration: "0.88 mm/s",
    temp: "54.2 °C",
    pressure: "7.8 bar",
    ingestRate: "5,120 msg/s",
    bufferLatency: "14ms",
  },
  {
    id: "site-surabaya",
    name: "Site 03 // Surabaya Foundry",
    unit: "Furnace Induction Core #2",
    status: "WARNING PEAK",
    voltage: "415.1 V",
    current: "340.2 A",
    power: "210.5 kW",
    powerFactor: "0.91",
    vibration: "2.14 mm/s",
    temp: "88.6 °C",
    pressure: "24.1 bar",
    ingestRate: "2,980 msg/s",
    bufferLatency: "22ms",
  },
];

export default function LandingHero() {
  const [selectedSiteIndex, setSelectedSiteIndex] = useState(0);
  const activeSite = SITES_DATA[selectedSiteIndex];

  return (
    <section className="relative w-full border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Background Technical Grid Accent */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-size-[4rem_4rem]" 
      />

      <div className="relative max-w-7xl mx-auto flex flex-col items-center">
        
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xs mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-semibold">
            IIoT Engine v2.4 // ClickHouse + EMQX MQTT Multi-Tenant
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-center max-w-4xl font-sans">
          Unified Industrial IoT &amp; Telemetry for Multi-Site Manufacturing
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 text-center max-w-2xl font-normal leading-relaxed">
          Ingest and analyze high-frequency telemetry from distributed factory PLCs, energy meters, 
          and edge gateways directly into ClickHouse with sub-50ms ingestion latency and zero data loss.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-mono font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors shadow-sm"
          >
            Launch Live Console <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#architecture"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-mono font-medium border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Inspect Pipeline Specs
          </a>
        </div>

        {/* Telemetry Console Mockup / Simulation */}
        <div id="telemetry-preview" className="mt-14 w-full max-w-5xl rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 shadow-xl overflow-hidden">
          
          {/* Terminal Title Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-zinc-100/70 dark:bg-zinc-950/70 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 dark:bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 dark:bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 dark:bg-emerald-500/80" />
              </div>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                EDGE_TELEMETRY_INGEST // STREAMING (TLS 1.3)
              </span>
            </div>

            {/* Site Switcher Tabs */}
            <div className="flex items-center gap-1 mt-2 sm:mt-0">
              {SITES_DATA.map((site, index) => (
                <button
                  key={site.id}
                  onClick={() => setSelectedSiteIndex(index)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    selectedSiteIndex === index
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  {site.name.split("//")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Plant Unit Subheader */}
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div>
              <span className="text-zinc-400">ACTIVE TARGET: </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">{activeSite.name}</span>
              <span className="text-zinc-400 mx-2">—</span>
              <span className="text-zinc-600 dark:text-zinc-400">{activeSite.unit}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-zinc-400">STATE:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activeSite.status.includes("OPTIMAL") || activeSite.status.includes("STABLE")
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}>
                {activeSite.status}
              </span>
              <span className="text-zinc-400">BUFFER LAG: <strong className="text-zinc-700 dark:text-zinc-300">{activeSite.bufferLatency}</strong></span>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
            
            <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-1">
                <span>VOLTAGE (RMS)</span>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{activeSite.voltage}</div>
              <div className="text-[10px] text-zinc-400 mt-1">3-Phase 50Hz</div>
            </div>

            <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-1">
                <span>LINE CURRENT</span>
                <Activity className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{activeSite.current}</div>
              <div className="text-[10px] text-zinc-400 mt-1">Phase L1 Peak</div>
            </div>

            <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-1">
                <span>ACTIVE POWER</span>
                <Gauge className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{activeSite.power}</div>
              <div className="text-[10px] text-zinc-400 mt-1">PF: {activeSite.powerFactor}</div>
            </div>

            <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-1">
                <span>VIBRATION RMS</span>
                <Cpu className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{activeSite.vibration}</div>
              <div className="text-[10px] text-zinc-400 mt-1">ISO 10816 Standard</div>
            </div>

            <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-1">
                <span>BEARING TEMP</span>
                <Flame className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{activeSite.temp}</div>
              <div className="text-[10px] text-zinc-400 mt-1">Stator Core</div>
            </div>

            <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-1">
                <span>INGEST THROUGHPUT</span>
                <Server className="w-3.5 h-3.5 text-cyan-500" />
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{activeSite.ingestRate}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">● EMQX Direct</div>
            </div>

          </div>

          {/* Real-time Ingestion Stream Bar */}
          <div className="px-5 py-3 bg-zinc-950 text-zinc-400 font-mono text-[11px] border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">&gt;&gt;</span>
              <span>BATCH_WRITER: Flushed 500 rows to `iiot_db.device_telemetry` via buffer worker</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-500">
              <span>ENGINE: ReplacingMergeTree</span>
              <span className="text-emerald-400 font-semibold">ACK 200 OK</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
