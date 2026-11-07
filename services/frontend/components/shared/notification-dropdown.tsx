
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Bell, BellOff } from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import { analyticsApi } from "@/lib/api-client";
import { evaluateAlarms } from "@/lib/alarms";
import type { AlarmItem } from "@/lib/types";
import { formatTimeAgo } from "./status-pulse";
import Link from "next/link";

const NotificationDropdown = () => {
  const { isSuperadmin, selectedTenantSlug } = useTenantContext();
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchAlarms = async () => {
      try {
        setLoading(true);
        const [devRes, sumRes] = await Promise.allSettled([
          analyticsApi.getDevicesStatus({
            tenant_slug: isSuperadmin ? selectedTenantSlug : undefined,
            limit: 20,
          }),
          analyticsApi.getSummaryTenant({
            tenant_slug: isSuperadmin ? selectedTenantSlug : undefined,
          }),
        ]);

        if (!active) return;

        const devices = devRes.status === "fulfilled" ? devRes.value.devices : [];
        const metrics = sumRes.status === "fulfilled" ? sumRes.value.metrics : [];

        const activeAlarms = evaluateAlarms({ devices, metrics });
        setAlarms(activeAlarms);
      } catch (err) {
        // silent fallback
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchAlarms();
    const intervalId = setInterval(fetchAlarms, 30000); // 30s background check
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isSuperadmin, selectedTenantSlug]);

  const hasCritical = alarms.some((a) => a.severity === "critical");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          aria-label="Notifikasi"
          className={cn(
            "relative rounded-full text-neutral-700 dark:text-neutral-200 sm:w-10 sm:h-10 w-8 h-8 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 dark:data-[state=open]:bg-slate-600 transition-colors"
          )}
        >
          <Bell className="size-5" />
          {alarms.length > 0 && (
            <span
              className={cn(
                "absolute -top-1 -inset-e-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm",
                hasCritical ? "bg-rose-500 animate-pulse" : "bg-amber-500"
              )}
            >
              {alarms.length > 9 ? "9+" : alarms.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-85 sm:w-95 p-0 rounded-2xl overflow-hidden shadow-xl border border-neutral-200 dark:border-slate-700"
      >
        <div>
          <div className="py-3 px-4 rounded-xl bg-primary/10 dark:bg-primary/20 m-3 flex items-center justify-between gap-2">
            <h6 className="text-base text-neutral-900 dark:text-white font-semibold mb-0">
              Peringatan & Alarm
            </h6>
            <span
              className={cn(
                "px-2.5 py-0.5 text-xs font-semibold rounded-full shadow-xs",
                alarms.length > 0
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                  : "bg-white dark:bg-slate-800 text-neutral-600 dark:text-neutral-300"
              )}
            >
              {alarms.length} Aktif
            </span>
          </div>

          {alarms.length === 0 ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-neutral-400 dark:text-neutral-500">
                <BellOff className="size-6" />
              </div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Tidak ada notifikasi baru
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-60 leading-relaxed">
                Semua alert perangkat, site, dan parameter telemetry dalam kondisi normal.
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-slate-800">
              {alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className="p-3 hover:bg-neutral-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3"
                >
                  <div className="mt-0.5 shrink-0">
                    {alarm.severity === "critical" ? (
                      <AlertCircle className="size-4 text-rose-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                        {alarm.title}
                      </p>
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {formatTimeAgo(alarm.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                      {alarm.message}
                    </p>
                  </div>
                </div>
              ))}
              <div className="p-2 text-center bg-neutral-50 dark:bg-slate-800/30">
                <Link
                  href="/devices"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Lihat Semua Perangkat &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;
