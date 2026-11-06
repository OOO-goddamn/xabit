"use client";

import { Moon, Sun } from "lucide-react";

import { toggleTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Переключить тему"
        title="Светлая или тёмная тема"
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition hover:border-forest/30 hover:text-forest",
          className,
        )}
      >
        <Moon size={17} className="dark:hidden" />
        <Sun size={17} className="hidden dark:block" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Переключить тему"
      title="Светлая или тёмная тема"
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-2xl border border-line/70 bg-surface/45 px-3 py-2.5 text-[12px] font-semibold text-muted transition hover:border-forest/25 hover:bg-surface hover:text-ink",
        className,
      )}
    >
      <span className="flex items-center gap-2.5">
        <Moon size={15} className="text-muted transition group-hover:text-forest" />
        Тёмная тема
      </span>
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full border border-line bg-cream transition-colors duration-300 dark:border-forest-solid dark:bg-forest-solid"
      >
        <span className="absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-ivory shadow-sm transition-transform duration-300 dark:translate-x-4" />
      </span>
    </button>
  );
}
