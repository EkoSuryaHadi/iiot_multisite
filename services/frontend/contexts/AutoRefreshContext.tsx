"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface AutoRefreshContextType {
  interval: number; // in milliseconds, 0 means off
  setIntervalValue: (interval: number) => void;
  countdown: number; // seconds remaining
  refreshTrigger: number; // incremented on each refresh
  refreshNow: () => void;
  isRefreshing: boolean;
}

const AutoRefreshContext = createContext<AutoRefreshContextType | undefined>(undefined);

export function AutoRefreshProvider({
  defaultInterval = 30000,
  children,
}: {
  defaultInterval?: number;
  children: React.ReactNode;
}) {
  const [interval, setIntervalValue] = useState<number>(defaultInterval);
  const [countdown, setCountdown] = useState<number>(Math.floor(defaultInterval / 1000));
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshNow = useCallback(() => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    if (interval > 0) {
      setCountdown(Math.floor(interval / 1000));
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, [interval]);

  useEffect(() => {
    if (interval <= 0) {
      setCountdown(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setCountdown(Math.floor(interval / 1000));

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshNow();
          return Math.floor(interval / 1000);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [interval, refreshNow]);

  return (
    <AutoRefreshContext.Provider
      value={{
        interval,
        setIntervalValue,
        countdown,
        refreshTrigger,
        refreshNow,
        isRefreshing,
      }}
    >
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefresh() {
  const context = useContext(AutoRefreshContext);
  if (!context) {
    // Return safe default if used outside provider
    return {
      interval: 0,
      setIntervalValue: () => {},
      countdown: 0,
      refreshTrigger: 0,
      refreshNow: () => {},
      isRefreshing: false,
    };
  }
  return context;
}
