"use client";

import { useEffect } from "react";
import useSWR from "swr";

import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";
import { isPushEnabledLocally } from "@/lib/push";
import type { DashboardHabit, DashboardResponse } from "@/lib/types";

const FIRED_KEY = "habit:reminder-fired";
const CHECK_INTERVAL_MS = 30_000;
const DUE_WINDOW_MINUTES = 5;

function todayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function readFired(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeFired(fired: Record<string, string>) {
  try {
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    // Reminders are best-effort; a full storage must not break the app.
  }
}

/** Minutes elapsed since the reminder time today (negative before it). */
function minutesSince(time: string, now: Date) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return now.getHours() * 60 + now.getMinutes() - (hours * 60 + minutes);
}

function showBrowserNotification(habit: DashboardHabit) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  try {
    const notification = new Notification(`Пора: ${habit.name}`, {
      body: habit.description || `Напоминание на ${habit.reminderTime}`,
      tag: `habit-reminder-${habit.id}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks habits with a reminder time every 30 seconds while the app is open.
 * Shows a browser notification when permission is granted and an in-app toast
 * otherwise. It never reminds about habits already marked done/skipped today.
 */
export function ReminderScheduler() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data } = useSWR<DashboardResponse>(user ? "/api/dashboard" : null, {
    refreshInterval: 5 * 60_000,
  });

  useEffect(() => {
    if (!user || !data) {
      return;
    }

    const dashboard = data;

    function check() {
      // With Web Push enabled the backend delivers reminders even when this
      // tab is closed; firing the local notification here would duplicate them.
      if (isPushEnabledLocally()) {
        return;
      }

      const now = new Date();
      const date = todayKey(now);
      const fired = readFired();
      let changed = false;

      for (const habit of dashboard.habits) {
        const settled =
          habit.completion?.status === "done" || habit.completion?.status === "skipped";
        if (!habit.reminderTime || settled || habit.due === false) {
          continue;
        }

        const diff = minutesSince(habit.reminderTime, now);
        if (diff === null || diff < 0 || diff > DUE_WINDOW_MINUTES) {
          continue;
        }

        const habitKey = String(habit.id);
        if (fired[habitKey] === date) {
          continue;
        }

        if (!showBrowserNotification(habit)) {
          toast(`Пора: ${habit.name}`, "info");
        }

        logger.info("Напоминание о привычке", {
          habit: habit.name,
          time: habit.reminderTime,
          channel: "Notification" in window && Notification.permission === "granted"
            ? "notification"
            : "toast",
        });

        fired[habitKey] = date;
        changed = true;
      }

      if (changed) {
        // Keep the map small: entries from previous days are no longer needed.
        for (const [habitKey, value] of Object.entries(fired)) {
          if (value !== date) {
            delete fired[habitKey];
          }
        }
        writeFired(fired);
      }
    }

    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [data, toast, user]);

  return null;
}
