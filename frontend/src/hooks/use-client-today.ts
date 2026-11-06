"use client";

import { useSyncExternalStore } from "react";

import { todayISO } from "@/lib/utils";

const subscribe = () => () => {};
const getSnapshot = () => todayISO();
const getServerSnapshot = () => null;

/**
 * Returns today's local date only after hydration.
 * Keeps prerendered HTML deterministic while avoiding a setState-in-effect.
 */
export function useClientToday() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
