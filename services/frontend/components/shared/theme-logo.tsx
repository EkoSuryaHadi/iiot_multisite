"use client";

import React from "react";
import GaungnusaLogo from "./gaungnusa-logo";

interface ThemeLogoProps {
  className?: string;
  size?: number;
  iconOnly?: boolean;
  showTagline?: boolean;
}

export default function ThemeLogo({
  className = "",
  size = 38,
  iconOnly = false,
  showTagline = true,
}: ThemeLogoProps) {
  return (
    <GaungnusaLogo
      size={size}
      iconOnly={iconOnly}
      showTagline={showTagline}
      className={className}
    />
  );
}
