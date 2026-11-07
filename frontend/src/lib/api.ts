import type { AuthResponse, CompletionInput, HabitInput, User } from "@/lib/types";
import { authHeaders, clearToken } from "@/lib/session";
import { logger } from "@/lib/logger";

const directBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function resolveUrl(path: string) {
  return directBase ? `${directBase}${path}` : path;
}

function handleUnauthorized(path: string) {
  if (path.startsWith("/api/auth/")) {
    return;
  }

  clearToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("habit:unauthorized"));
  }
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) {
      return payload.error;
    }
  } catch {
    // Ignore invalid or empty error bodies.
  }
  return `Запрос завершился с ошибкой ${response.status}`;
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const started = Date.now();
  let response: Response;

  try {
    response = await fetch(resolveUrl(path), {
      method,
      headers: {
        Accept: "application/json",
        ...authHeaders(),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // Network-level failure: DNS, TLS, CORS, offline, blocked mixed content.
    logger.error("API недоступен", {
      method,
      path,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error : String(error),
    });
    throw error;
  }

  const durationMs = Date.now() - started;

  if (!response.ok) {
    const message = await parseError(response);
    if (response.status === 401) {
      handleUnauthorized(path);
    }
    logger.error("API вернул ошибку", {
      method,
      path,
      status: response.status,
      durationMs,
      error: message,
    });
    throw new ApiError(message, response.status);
  }

  logger.debug("API запрос выполнен", {
    method,
    path,
    status: response.status,
    durationMs,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetcher<T>(path: string): Promise<T> {
  return request<T>(path, "GET");
}

export const api = {
  register: (input: { email: string; password: string; name?: string }) =>
    request<AuthResponse>("/api/auth/register", "POST", input),

  login: (input: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", "POST", input),

  logout: () => request<void>("/api/auth/logout", "POST"),

  me: () => fetcher<User>("/api/auth/me"),

  createCategory: (name: string) =>
    request<{ id: number; name: string }>("/api/categories", "POST", { name }),

  updateCategory: (id: number, name: string) =>
    request<{ id: number; name: string }>(`/api/categories/${id}`, "PATCH", { name }),

  deleteCategory: (id: number) => request<void>(`/api/categories/${id}`, "DELETE"),

  createHabit: (input: HabitInput) =>
    request<{ id: number }>("/api/habits", "POST", input),

  updateHabit: (id: number, input: HabitInput) =>
    request<{ id: number }>(`/api/habits/${id}`, "PATCH", input),

  deleteHabit: (id: number) => request<void>(`/api/habits/${id}`, "DELETE"),

  saveCompletion: (input: CompletionInput) =>
    request<{ id: number }>("/api/completions", "PUT", input),

  deleteCompletion: (habitId: number, date: string) =>
    request<void>(
      `/api/completions?habitId=${habitId}&date=${encodeURIComponent(date)}`,
      "DELETE",
    ),
};
