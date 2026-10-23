"use client";

import React from "react";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export interface RadialGaugeProps {
  title: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  className?: string;
}

export function RadialGauge({
  title,
  value,
  min = 0,
  max = 100,
  unit = "",
  warningThreshold = 70,
  criticalThreshold = 90,
  className,
}: RadialGaugeProps) {
  // Normalize percentage for radialBar (0 - 100%)
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  // Determine color status
  let barColor = "#10B981"; // Emerald green
  let statusBadge = "Normal";
  let statusClass = "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400";

  if (value >= criticalThreshold) {
    barColor = "#EF4444"; // Red
    statusBadge = "Critical";
    statusClass = "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400";
  } else if (value >= warningThreshold) {
    barColor = "#F59E0B"; // Amber
    statusBadge = "Warning";
    statusClass = "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400";
  }

  const chartOptions: ApexOptions = {
    chart: {
      type: "radialBar",
      sparkline: { enabled: true },
    },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: {
          margin: 0,
          size: "68%",
          background: "transparent",
        },
        track: {
          background: "#e2e8f0",
          strokeWidth: "100%",
          margin: 0,
        },
        dataLabels: {
          show: true,
          name: {
            show: false,
          },
          value: {
            offsetY: 8,
            fontSize: "24px",
            fontWeight: "700",
            formatter: () => `${value.toFixed(1)}${unit ? " " + unit : ""}`,
          },
        },
      },
    },
    fill: {
      colors: [barColor],
    },
    stroke: {
      lineCap: "round",
    },
  };

  return (
    <Card className={cn("border border-neutral-200 dark:border-slate-700 shadow-none overflow-hidden", className)}>
      <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold capitalize truncate">{title}</CardTitle>
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider", statusClass)}>
          {statusBadge}
        </span>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex flex-col items-center">
        <div className="w-full flex justify-center -mb-4">
          <Chart options={chartOptions} series={[Math.round(percentage)]} type="radialBar" height={190} />
        </div>
        <div className="w-full flex justify-between text-xs text-neutral-400 font-mono px-4 pt-2 border-t border-neutral-100 dark:border-slate-800">
          <span>Min: {min}{unit}</span>
          <span>Max: {max}{unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default RadialGauge;
