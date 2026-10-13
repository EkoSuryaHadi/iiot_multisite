"use client";

import type { TelemetryPoint } from "@/lib/types";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function TelemetryChart({ points, metricName }: { points: TelemetryPoint[]; metricName: string }) {
  const series: ApexOptions["series"] = [
    {
      name: metricName,
      data: points.map((p) => ({
        x: new Date(p.ts).getTime(),
        y: p.value ?? p.avg ?? 0,
      })),
    },
  ];

  const options: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", colors: ["#487FFF"], width: 3 },
    markers: { size: 0, strokeWidth: 3, hover: { size: 6 } },
    tooltip: { enabled: true, x: { format: "dd MMM yyyy HH:mm:ss" } },
    grid: {
      row: { colors: ["transparent", "transparent"], opacity: 0.5 },
      borderColor: "#D1D5DB",
      strokeDashArray: 3,
    },
    xaxis: {
      type: "datetime",
      labels: { style: { fontSize: "12px" } },
    },
    yaxis: {
      labels: { style: { fontSize: "12px" } },
    },
  };

  return (
    <div className="-m-4">
      <Chart options={options} series={series} type="line" height={320} />
    </div>
  );
}
