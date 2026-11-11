"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";

import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  ensurePushSubscription,
  isPushEnabledLocally,
  loadPushConfig,
  pushSupported,
  subscribePush,
  unsubscribePush,
} from "@/lib/push";
import { cn, errorMessage } from "@/lib/utils";

import { useAuth } from "./auth-provider";
import { useToast } from "./ui/toast";

type PushStatus = "loading" | "unsupported" | "unavailable" | "off" | "on";

/**
 * Sidebar switch for Web Push. When it is on, reminders are delivered by the
 * backend even if the tab is closed, so the in-app scheduler stays quiet.
 */
export function PushToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    async function init() {
      if (!pushSupported()) {
        setStatus("unsupported");
        return;
      }

      try {
        const config = await loadPushConfig();
        if (cancelled) {
          return;
        }
        if (!config.enabled || !config.publicKey) {
          setStatus("unavailable");
          return;
        }

        if (isPushEnabledLocally() && Notification.permission === "granted") {
          try {
            // The push service can rotate keys or drop a subscription: keep the
            // backend in sync on every visit.
            await ensurePushSubscription(config.publicKey);
            if (!cancelled) {
              setStatus("on");
            }
            return;
          } catch (error) {
            logger.warn("Не удалось восстановить push-подписку", { error });
          }
        }

        if (!cancelled) {
          setStatus("off");
        }
      } catch (error) {
        logger.warn("Не удалось получить настройки push", { error });
        if (!cancelled) {
          setStatus("unavailable");
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function toggle() {
    if (busy) {
      return;
    }

    setBusy(true);
    try {
      if (status === "on") {
        await unsubscribePush();
        setStatus("off");
        toast("Push-уведомления отключены", "info");
      } else {
        await subscribePush();
        setStatus("on");
        toast("Push-уведомления включены");
      }
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (testing) {
      return;
    }

    setTesting(true);
    try {
      const result = await api.testPush();
      toast(
        result.sent > 1
          ? `Тестовое уведомление отправлено на ${result.sent} устройства`
          : "Тестовое уведомление отправлено",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setTesting(false);
    }
  }

  if (status === "loading" || status === "unsupported" || status === "unavailable") {
    return null;
  }

  const enabled = status === "on";

  return (
    <div className={cn("space-y-1", className)}>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={enabled}
        title="Напоминания при закрытом браузере"
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-line/70 bg-surface/45 px-3 py-2.5 text-[12px] font-semibold text-muted transition hover:border-forest/25 hover:bg-surface hover:text-ink disabled:opacity-60"
      >
        <span className="flex items-center gap-2.5">
          {busy ? (
            <Loader2 size={15} className="animate-spin text-forest" />
          ) : (
            <BellRing
              size={15}
              className={cn("transition", enabled ? "text-forest" : "text-muted group-hover:text-forest")}
            />
          )}
          Push-уведомления
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-300",
            enabled ? "border-forest-solid bg-forest-solid" : "border-line bg-cream",
          )}
        >
          <span
            className={cn(
              "absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-ivory shadow-sm transition-transform duration-300",
              enabled && "translate-x-4",
            )}
          />
        </span>
      </button>

      {enabled ? (
        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={testing}
          className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition hover:text-forest disabled:opacity-60"
        >
          {testing ? "Отправляем…" : "Проверить уведомление"}
        </button>
      ) : null}
    </div>
  );
}
