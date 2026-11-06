"use client";

import { useEffect } from "react";

import { applyTheme, storedTheme } from "@/lib/theme";

export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function onChange(event: MediaQueryListEvent) {
      if (storedTheme()) {
        return;
      }
      applyTheme(event.matches ? "dark" : "light", false);
    }

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
