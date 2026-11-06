"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

/**
 * Revalidates every API key currently known to SWR.
 * Used after a mutation so lists, dashboard and stats stay in sync.
 */
export function useRevalidateApi() {
  const { mutate } = useSWRConfig();

  return useCallback(
    () =>
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/"),
        undefined,
        { revalidate: true },
      ),
    [mutate],
  );
}
