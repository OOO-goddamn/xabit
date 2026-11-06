"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeSync } from "@/components/theme-sync";
import { fetcher } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      <ThemeSync />
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </SWRConfig>
  );
}
