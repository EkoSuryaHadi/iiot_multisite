"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-9">
        <Sun className="size-4" />
      </Button>
    )
  }
  return (
    <Button variant="ghost" size="icon" className="size-9" 
    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Moon className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Sun className="absolutesize-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      
    </Button>
  )



}