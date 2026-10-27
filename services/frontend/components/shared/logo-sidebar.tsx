"use client";

import React from "react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";
import GaungnusaLogo, { GaungnusaIcon } from "./gaungnusa-logo";

export default function LogoSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div
      className={`flex h-16 items-center border-b border-neutral-200 dark:border-zinc-800/80 transition-all duration-200 ${
        isCollapsed ? "justify-center px-2" : "px-4"
      }`}
    >
      <Link
        href="/dashboard"
        className={`flex items-center gap-3 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded ${
          isCollapsed ? "justify-center w-full" : "w-full"
        }`}
        title="Gaungnusa Dashboard"
      >
        {isCollapsed ? (
          <div className="flex items-center justify-center">
            <GaungnusaIcon size={28} />
          </div>
        ) : (
          <GaungnusaLogo size={32} showTagline={true} />
        )}
      </Link>
    </div>
  );
}