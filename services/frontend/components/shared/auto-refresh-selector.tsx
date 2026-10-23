"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAutoRefresh } from "@/contexts/AutoRefreshContext";
import { Check, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS = [
  { label: "Off (Manual)", value: 0 },
  { label: "10 Detik", value: 10000 },
  { label: "30 Detik", value: 30000 },
  { label: "1 Menit", value: 60000 },
  { label: "5 Menit", value: 300000 },
];

export default function AutoRefreshSelector({ className }: { className?: string }) {
  const { interval, setIntervalValue, countdown, refreshNow, isRefreshing } = useAutoRefresh();

  const currentOption = INTERVAL_OPTIONS.find((opt) => opt.value === interval) || INTERVAL_OPTIONS[0];

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={refreshNow}
        disabled={isRefreshing}
        title="Refresh data sekarang"
        className="h-9 px-3 gap-1.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium cursor-pointer shadow-none"
      >
        <RefreshCw className={cn("size-3.5 text-neutral-600 dark:text-neutral-300", isRefreshing && "animate-spin text-primary")} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium cursor-pointer shadow-none"
          >
            <Clock className="size-3.5 text-neutral-500" />
            <span>
              {interval === 0 ? (
                "Auto: Off"
              ) : (
                <>
                  Auto: {Math.floor(interval / 1000)}s
                  <span className="ms-1 text-[11px] text-primary font-mono font-semibold">
                    ({countdown}s)
                  </span>
                </>
              )}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 p-1">
          <DropdownMenuLabel className="text-xs text-neutral-500 font-normal">
            Interval Pembaruan Data
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {INTERVAL_OPTIONS.map((opt) => {
            const isSelected = opt.value === interval;
            return (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setIntervalValue(opt.value)}
                className="flex items-center justify-between text-xs cursor-pointer py-1.5"
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
