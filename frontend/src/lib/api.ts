import type { AuthResponse, CompletionInput, HabitInput, User } from "@/lib/types";
import { authHeaders, clearToken } from "@/lib/session";

const directBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
console.log('directBase: ', directBase)
console.log('process.env: ', process.env)
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

export async function fetcher<T>(path: string): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    headers: { Accept: "application/json", ...authHeaders() },
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized(path);
    }
    throw new ApiError(await parseError(response), response.status);
  }

  return (await response.json()) as T;
}

async function mutateRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...authHeaders(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized(path);
    }
    throw new ApiError(await parseError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  register: (input: { email: string; password: string; name?: string }) =>
    mutateRequest<AuthResponse>("/api/auth/register", "POST", input),

  login: (input: { email: string; password: string }) =>
    mutateRequest<AuthResponse>("/api/auth/login", "POST", input),

  logout: () => mutateRequest<void>("/api/auth/logout", "POST"),

  me: () => fetcher<User>("/api/auth/me"),

  createCategory: (name: string) =>
    mutateRequest<{ id: number; name: string }>("/api/categories", "POST", { name }),

  updateCategory: (id: number, name: string) =>
    mutateRequest<{ id: number; name: string }>(`/api/categories/${id}`, "PATCH", { name }),

  deleteCategory: (id: number) =>
    mutateRequest<void>(`/api/categories/${id}`, "DELETE"),

  createHabit: (input: HabitInput) =>
    mutateRequest<{ id: number }>("/api/habits", "POST", input),

  updateHabit: (id: number, input: HabitInput) =>
    mutateRequest<{ id: number }>(`/api/habits/${id}`, "PATCH", input),

  deleteHabit: (id: number) =>
    mutateRequest<void>(`/api/habits/${id}`, "DELETE"),

  saveCompletion: (input: CompletionInput) =>
    mutateRequest<{ id: number }>("/api/completions", "PUT", input),

  deleteCompletion: (habitId: number, date: string) =>
    mutateRequest<void>(
      `/api/completions?habitId=${habitId}&date=${encodeURIComponent(date)}`,
      "DELETE",
    ),
};
