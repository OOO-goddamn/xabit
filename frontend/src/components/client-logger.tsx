"use client";

import { useEffect } from "react";

import { installGlobalLogging, logger } from "@/lib/logger";

/**
 * Installs global error handlers once per page load. It renders nothing; the
 * collected entries are shown on the /debug page.
 */
export function ClientLogger() {
  useEffect(() => {
    installGlobalLogging();
    logger.info("Клиент запущен", {
      path: window.location.pathname,
      api: process.env.NEXT_PUBLIC_API_URL || "same-origin",
    });
  }, []);

  return null;
}
