"use client";

import type { TelemetryPoint } from "@/lib/types";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface TelemetryChartProps {
  points: TelemetryPoint[];
  metricName: string;
  unit?: string;
  interval?: "raw" | "1m" | "1h";
}

export default function TelemetryChart({
  points,
  metricName,
  unit = "",
  interval = "raw",
}: TelemetryChartProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  const isAggregated = interval !== "raw" && points.some((p) => p.min !== undefined && p.max !== undefined);

  const series: ApexOptions["series"] = isAggregated
    ? [
        {
          name: `Rata-rata (${metricName})`,
          type: "area",
          data: points.map((p) => ({
            x: new Date(p.ts).getTime(),
            y: p.avg !== null && p.avg !== undefined ? Number(p.avg.toFixed(2)) : 0,
          })),
        },
        {
          name: `Maksimum`,
          type: "line",
          data: points.map((p) => ({
            x: new Date(p.ts).getTime(),
            y: p.max !== null && p.max !== undefined ? Number(p.max.toFixed(2)) : 0,
          })),
        },
        {
          name: `Minimum`,
          type: "line",
          data: points.map((p) => ({
            x: new Date(p.ts).getTime(),
            y: p.min !== null && p.min !== undefined ? Number(p.min.toFixed(2)) : 0,
          })),
        },
      ]
    : [
        {
          name: `${metricName}${unit ? ` (${unit})` : ""}`,
          type: "area",
          data: points.map((p) => ({
            x: new Date(p.ts).getTime(),
            y: p.value !== null && p.value !== undefined ? Number(p.value.toFixed(2)) : (p.avg ?? 0),
          })),
        },
      ];

  const colors = isAggregated
    ? ["#3B82F6", "#F59E0B", "#06B6D4"] // Primary Blue (Avg), Amber (Max), Cyan (Min)
    : ["#3B82F6"];

  const options: ApexOptions = {
    chart: {
      type: "area",
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      zoom: { enabled: true },
      background: "transparent",
      fontFamily: "inherit",
    },
    colors,
    stroke: {
      curve: "smooth",
      width: isAggregated ? [3, 2, 2] : [2.5],
      dashArray: isAggregated ? [0, 4, 4] : [0],
    },
    fill: {
      type: isAggregated ? ["gradient", "solid", "solid"] : ["gradient"],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: isDark ? 0.45 : 0.4,
        opacityTo: 0.05,
        stops: [0, 95, 100],
      },
    },
    markers: {
      size: points.length < 30 ? 3 : 0,
      strokeWidth: 2,
      hover: { size: 6 },
    },
    dataLabels: { enabled: false },
    tooltip: {
      enabled: true,
      theme: isDark ? "dark" : "light",
      x: { format: "dd MMM yyyy, HH:mm:ss" },
      y: {
        formatter: (val) => `${val !== undefined && val !== null ? val : "-"} ${unit}`.trim(),
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      labels: {
        colors: isDark ? "#94A3B8" : "#475569",
      },
      markers: {
        size: 5,
      },
    },
    grid: {
      borderColor: isDark ? "#334155" : "#E2E8F0",
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: "datetime",
      labels: {
        style: {
          colors: isDark ? "#94A3B8" : "#64748B",
          fontSize: "11px",
        },
        datetimeUTC: false,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? "#94A3B8" : "#64748B",
          fontSize: "11px",
        },
        formatter: (val) => `${val.toFixed(1)}${unit ? ` ${unit}` : ""}`,
      },
    },
  };

  return (
    <div className="w-full">
      <Chart options={options} series={series} height={340} />
    </div>
  );
}
