import React from "react";
import { cn } from "@/lib/utils";

export interface StatusPulseProps {
  status: "online" | "offline" | "stale" | string;
  showText?: boolean;
  className?: string;
}

export function StatusPulse({ status, showText = true, className }: StatusPulseProps) {
  const isOnline = status.toLowerCase() === "online";
  const isStale = status.toLowerCase() === "stale";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border",
        isOnline
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
          : isStale
          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
          : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-slate-800 dark:text-neutral-300 dark:border-slate-700",
        className
      )}
    >
      <span className="relative flex size-2">
        {isOnline && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            isOnline ? "bg-emerald-500" : isStale ? "bg-amber-500" : "bg-neutral-400 dark:bg-neutral-500"
          )}
        />
      </span>
      {showText && <span className="capitalize">{status}</span>}
    </div>
  );
}

export function formatTimeAgo(dateInput: string | Date | number): string {
  if (!dateInput) return "-";
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < 60) return "Baru saja";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  return `${Math.floor(diffSec / 86400)} hari lalu`;
}
