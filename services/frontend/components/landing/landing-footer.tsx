"use client";

import React from "react";
import Link from "next/link";
import ThemeLogo from "@/components/shared/theme-logo";

export default function LandingFooter() {
  return (
    <footer className="w-full border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8 border-b border-zinc-200 dark:border-zinc-800/60">
        
        {/* Brand & Mission */}
        <div className="space-y-3 max-w-sm">
          <ThemeLogo />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
            High-frequency multi-plant industrial IoT platform powered by EMQX MQTT and ClickHouse analytical storage.
          </p>
        </div>

        {/* Technical Status & Navigation */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-10 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-700 dark:text-zinc-300">TELEMETRY_PIPELINE: NORMAL</span>
          </div>

          <Link href="#capabilities" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
            Capabilities
          </Link>
          <Link href="#architecture" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
            Pipeline Architecture
          </Link>
          <Link href="/auth/login" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
            Console Login
          </Link>
          <Link href="/auth/register" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
            Request Access
          </Link>
        </div>
      </div>

      {/* Copyright row */}
      <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-500">
        <div>
          &copy; {new Date().getFullYear()} IIoT Multi-Site Platform // Enterprise Telemetry Core.
        </div>
        <div className="text-[11px] text-zinc-400">
          STRICTLY INDUSTRIAL DATA RETENTION // ENCRYPTED VIA mTLS
        </div>
      </div>
    </footer>
  );
}
