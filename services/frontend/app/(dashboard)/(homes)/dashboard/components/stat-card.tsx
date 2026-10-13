"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useTenantContext } from "@/contexts/TenantContext";
import { analyticsApi, ApiRequestError } from "@/lib/api-client";
import { Activity, Server, WifiOff, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface CardData {
  title: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  gradientFrom: string;
  description: string;
}

const StatCard = () => {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [deviceCount, setDeviceCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [offlineCount, setOfflineCount] = useState(0);
  const [metricCount, setMetricCount] = useState(0);

  useEffect(() => {
    if (isSuperadmin && !selectedTenantSlug) return;

    let active = true;
    setLoading(true);

    analyticsApi
      .getSummaryTenant({ tenant_slug: isSuperadmin ? selectedTenantSlug : undefined })
      .then((summary) => {
        if (!active) return;
        setDeviceCount(summary.device_count);
        setOnlineCount(summary.online_count);
        setOfflineCount(summary.offline_count);
        setMetricCount(summary.metrics.length);
      })
      .catch((error) => {
        if (error instanceof ApiRequestError) toast.error(error.message);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [isSuperadmin, selectedTenantSlug]);

  const cardsDatas: CardData[] = [
    {
      title: "Total Devices",
      value: loading ? "..." : String(deviceCount),
      icon: Server,
      iconBg: "bg-primary",
      gradientFrom: "from-primary/10",
      description: "Terdaftar di tenant ini",
    },
    {
      title: "Online",
      value: loading ? "..." : String(onlineCount),
      icon: Zap,
      iconBg: "bg-green-600",
      gradientFrom: "from-green-600/10",
      description: "Aktif beberapa menit terakhir",
    },
    {
      title: "Offline",
      value: loading ? "..." : String(offlineCount),
      icon: WifiOff,
      iconBg: "bg-red-600",
      gradientFrom: "from-red-600/10",
      description: "Tidak ada data terbaru",
    },
    {
      title: "Metrik Terpantau",
      value: loading ? "..." : String(metricCount),
      icon: Activity,
      iconBg: "bg-cyan-600",
      gradientFrom: "from-cyan-600/10",
      description: "Jenis metrik 1 jam terakhir",
    },
  ];

  return (
    <>
      {cardsDatas.map((card, index) => (
        <Card
          key={index}
          className={`bg-gradient-to-r ${card.gradientFrom} to-white dark:to-slate-700 p-0 border border-gray-200 dark:border-neutral-700 rounded-md shadow-none`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{card.title}</p>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{card.value}</h3>
              </div>
              <div className={`w-12 h-12 ${card.iconBg} rounded-full flex items-center justify-center`}>
                <card.icon className="text-white" size={24} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm mt-4">
              <span className="text-neutral-500 dark:text-neutral-400 text-[13px]">{card.description}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

export default StatCard;
