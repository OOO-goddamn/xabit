import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

const ENABLED_KEY = "habit:push-enabled";

function basePath() {
  const value = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
  if (!value || value === "/") {
    return "";
  }
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isPushEnabledLocally() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function setPushEnabledLocally(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(ENABLED_KEY, "1");
    } else {
      window.localStorage.removeItem(ENABLED_KEY);
    }
  } catch {
    // Private mode can block storage; push still works for this session.
  }
}

async function registerServiceWorker() {
  const base = basePath();
  const registration = await navigator.serviceWorker.register(`${base}/sw.js`, {
    scope: `${base}/`,
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
  return registration;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

export function loadPushConfig() {
  return api.pushConfig();
}

/**
 * Reuses an existing browser subscription or creates a new one and stores it
 * on the backend together with the browser timezone.
 */
export async function ensurePushSubscription(publicKey: string) {
  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh ?? "";
  const auth = json.keys?.auth ?? "";
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Браузер вернул неполную push-подписку");
  }

  await api.savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh, auth },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

export async function subscribePush() {
  if (!pushSupported()) {
    throw new Error("Этот браузер не поддерживает push-уведомления");
  }

  // Ask for permission first: Safari and some Chrome versions only show the
  // prompt while the original click still counts as a user gesture.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Браузер запретил уведомления. Разрешите их в настройках сайта и попробуйте снова",
    );
  }

  const config = await loadPushConfig();
  if (!config.enabled || !config.publicKey) {
    throw new Error("Push-уведомления не настроены на сервере");
  }

  await ensurePushSubscription(config.publicKey);
  setPushEnabledLocally(true);

  logger.info("Push-уведомления включены", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

export async function unsubscribePush() {
  setPushEnabledLocally(false);

  if (!pushSupported()) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  try {
    await api.deletePushSubscription(subscription.endpoint);
  } catch (error) {
    // Unsubscribing locally still stops notifications; the server drops the
    // dead endpoint when the push service answers 404/410.
    logger.warn("Не удалось удалить push-подписку на сервере", { error });
  }

  await subscription.unsubscribe();
  logger.info("Push-уведомления отключены");
}
