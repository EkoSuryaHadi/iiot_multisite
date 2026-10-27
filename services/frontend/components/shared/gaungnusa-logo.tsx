"use client";

import React, { useId } from "react";

interface GaungnusaIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * GaungnusaIcon: Pure SVG implementation of Model 3C
 * Geometric G monogram surrounded by sonic radar telemetry arcs ("Gaung")
 */
export function GaungnusaIcon({
  size = 36,
  className = "",
  ...props
}: GaungnusaIconProps) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const glowId = `gn-cyan-glow-${id}`;
  const filterId = `gn-glow-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <defs>
        {/* Glowing electric cyan gradient for active telemetry */}
        <linearGradient id={glowId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Ambient glow filter for high-tech telemetry pulse */}
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* --- OUTER RADAR RING (Radius 44) --- */}
      {/* Top-Left Outer Arc (Electric Cyan) */}
      <path
        d="M 18 36 A 44 44 0 0 1 40 8"
        stroke={`url(#${glowId})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Top-Right Outer Arc (Slate / White adaptive) */}
      <path
        d="M 60 8 A 44 44 0 0 1 88 30"
        stroke="currentColor"
        className="text-zinc-400 dark:text-zinc-200"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Bottom-Right Outer Arc (Electric Cyan) */}
      <path
        d="M 94 48 A 44 44 0 0 1 76 86"
        stroke={`url(#${glowId})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Bottom-Left Outer Arc (Slate / White adaptive) */}
      <path
        d="M 52 94 A 44 44 0 0 1 14 66"
        stroke="currentColor"
        className="text-zinc-400 dark:text-zinc-200"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* --- MIDDLE SONIC WAVE RING (Radius 33) --- */}
      {/* Left Sonic Wave (Electric Cyan) */}
      <path
        d="M 19 40 A 33 33 0 0 1 42 18"
        stroke={`url(#${glowId})`}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Bottom Sonic Wave (Electric Cyan) */}
      <path
        d="M 38 82 A 33 33 0 0 1 20 62"
        stroke={`url(#${glowId})`}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Right Sonic Wave (Slate / White adaptive) */}
      <path
        d="M 83 44 A 33 33 0 0 1 68 76"
        stroke="currentColor"
        className="text-zinc-400 dark:text-zinc-200"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* --- CORE MONOGRAM G (Radius 22) --- */}
      {/* Circular spine of G (from top-right, counter-clockwise to 3 o'clock) */}
      <path
        d="M 64 32 A 22 22 0 1 0 72 50 L 50 50"
        stroke="currentColor"
        className="text-zinc-900 dark:text-white"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Internal Telemetry Vertical Cross-Spine (Electric Cyan) */}
      <path
        d="M 50 28 L 50 72"
        stroke={`url(#${glowId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Internal Telemetry Horizontal Signal Bar */}
      <path
        d="M 50 50 L 68 50"
        stroke={`url(#${glowId})`}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Central Telemetry Beacon Core (Sensor Node) */}
      <circle cx="50" cy="50" r="3.5" fill={`url(#${glowId})`} filter={`url(#${filterId})`} />
      <circle cx="50" cy="50" r="1.5" fill="#ffffff" />
    </svg>
  );
}

interface GaungnusaLogoProps {
  size?: number;
  iconOnly?: boolean;
  showTagline?: boolean;
  className?: string;
}

/**
 * GaungnusaLogo: Complete logo with Icon + Industrial Typography
 */
export default function GaungnusaLogo({
  size = 38,
  iconOnly = false,
  showTagline = true,
  className = "",
}: GaungnusaLogoProps) {
  if (iconOnly) {
    return <GaungnusaIcon size={size} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon with subtle hover animation */}
      <div className="relative flex items-center justify-center transition-transform duration-300 hover:scale-105">
        <GaungnusaIcon size={size} />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center">
          <span className="font-extrabold text-[1.15rem] tracking-[0.14em] uppercase text-zinc-900 dark:text-white font-sans">
            GAUNG<span className="text-cyan-500 dark:text-cyan-400">NUSA</span>
          </span>
        </div>
        {showTagline && (
          <span className="text-[9px] font-mono font-medium tracking-[0.24em] uppercase text-zinc-500 dark:text-zinc-400 mt-1">
            INDUSTRIAL IOT
          </span>
        )}
      </div>
    </div>
  );
}
