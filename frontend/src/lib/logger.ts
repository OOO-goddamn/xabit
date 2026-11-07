export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

const LOGS_KEY = "habit:logs";
const DEBUG_KEY = "habit:debug";
const MAX_ENTRIES = 200;
const MAX_VALUE_LENGTH = 2000;
const MAX_STACK_LINES = 8;
const EMPTY_LOGS: LogEntry[] = [];

let counter = 0;
let installed = false;
let loaded = false;
let logs: LogEntry[] = EMPTY_LOGS;

const logListeners = new Set<() => void>();
const debugListeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

function truncate(value: string) {
  return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
}

function normalizeError(error: Error) {
  return {
    name: error.name,
    message: truncate(error.message),
    stack: error.stack?.split("\n").slice(0, MAX_STACK_LINES).join("\n"),
  };
}

function normalizeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }
    if (value instanceof Error) {
      result[key] = normalizeError(value);
    } else if (typeof value === "string") {
      result[key] = truncate(value);
    } else if (value === null || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else {
      try {
        result[key] = truncate(JSON.stringify(value));
      } catch {
        result[key] = String(value);
      }
    }
  }

  return result;
}

function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.ts === "string" &&
    typeof entry.level === "string" &&
    typeof entry.message === "string"
  );
}

function ensureLoaded() {
  if (!isBrowser() || loaded) {
    return;
  }
  loaded = true;

  try {
    const raw = window.localStorage.getItem(LOGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    logs = Array.isArray(parsed) ? parsed.filter(isLogEntry) : EMPTY_LOGS;
  } catch {
    logs = EMPTY_LOGS;
  }
}

function notify(listeners: Set<() => void>) {
  listeners.forEach((listener) => listener());
}

function persist() {
  try {
    window.localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {
    // Logs are best-effort: drop the write if the quota is exceeded.
  }
}

/**
 * Re-reads logs from localStorage (for example, when another tab wrote them).
 */
export function reloadLogs() {
  loaded = false;
  ensureLoaded();
  notify(logListeners);
}

export function subscribeLogs(listener: () => void) {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

export function getLogsSnapshot() {
  ensureLoaded();
  return logs;
}

export function getLogsServerSnapshot() {
  return EMPTY_LOGS;
}

export function isDebugEnabled() {
  if (!isBrowser()) {
    return false;
  }

  try {
    return window.localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function subscribeDebug(listener: () => void) {
  debugListeners.add(listener);
  return () => {
    debugListeners.delete(listener);
  };
}

export function getDebugServerSnapshot() {
  return false;
}

export function setDebugEnabled(enabled: boolean) {
  if (!isBrowser()) {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(DEBUG_KEY, "1");
    } else {
      window.localStorage.removeItem(DEBUG_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, quota); logging stays best-effort.
  }

  notify(debugListeners);
}

export function clearLogs() {
  loaded = true;
  logs = EMPTY_LOGS;

  if (isBrowser()) {
    try {
      window.localStorage.removeItem(LOGS_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  notify(logListeners);
}

function shouldRecord(level: LogLevel) {
  return level === "warn" || level === "error" || isDebugEnabled();
}

function mirror(entry: LogEntry) {
  const args: unknown[] = [`[habit] ${entry.message}`];
  if (entry.data) {
    args.push(entry.data);
  }

  switch (entry.level) {
    case "error":
      console.error(...args);
      break;
    case "warn":
      console.warn(...args);
      break;
    case "info":
      console.info(...args);
      break;
    default:
      console.debug(...args);
  }
}

function record(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (!isBrowser() || !shouldRecord(level)) {
    return;
  }

  ensureLoaded();

  counter += 1;
  const entry: LogEntry = {
    id: `${Date.now().toString(36)}-${counter}`,
    ts: new Date().toISOString(),
    level,
    message,
  };

  const normalized = normalizeData(data);
  if (normalized && Object.keys(normalized).length > 0) {
    entry.data = normalized;
  }

  logs = logs.concat(entry).slice(-MAX_ENTRIES);
  persist();
  notify(logListeners);
  mirror(entry);
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    record("debug", message, data);
  },
  info(message: string, data?: Record<string, unknown>) {
    record("info", message, data);
  },
  warn(message: string, data?: Record<string, unknown>) {
    record("warn", message, data);
  },
  error(message: string, data?: Record<string, unknown>) {
    record("error", message, data);
  },
};

/**
 * Captures errors that escape React (global handlers), so they end up in the
 * same buffer as API failures and can be inspected on /debug.
 */
export function installGlobalLogging() {
  if (!isBrowser() || installed) {
    return;
  }
  installed = true;

  // /debug/?debug=1 enables verbose logging for this browser.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      setDebugEnabled(true);
    }
  } catch {
    // Ignore malformed URLs.
  }

  window.addEventListener("storage", (event) => {
    if (event.key === LOGS_KEY || event.key === null) {
      loaded = false;
      ensureLoaded();
      notify(logListeners);
    }
    if (event.key === DEBUG_KEY || event.key === null) {
      notify(debugListeners);
    }
  });

  window.addEventListener("error", (event) => {
    logger.error("Необработанная ошибка", {
      message: event.message || "Unknown error",
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error instanceof Error ? event.error : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    logger.error("Необработанный Promise rejection", {
      error: reason instanceof Error ? reason : undefined,
      reason: reason instanceof Error ? undefined : String(reason),
    });
  });
}
