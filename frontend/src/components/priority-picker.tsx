"use client";

import type { TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

export const priorityOptions: Array<{
  value: TaskPriority;
  label: string;
  active: string;
}> = [
  { value: "low", label: "Низкий", active: "bg-slate text-ivory" },
  { value: "normal", label: "Обычный", active: "bg-forest-solid text-ivory" },
  { value: "high", label: "Высокий", active: "bg-clay text-white" },
];

export function priorityLabel(priority: TaskPriority) {
  return priorityOptions.find((option) => option.value === priority)?.label ?? "Обычный";
}

export function PriorityPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Приоритет задачи"
      className="grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-cream/60 p-1.5"
    >
      {priorityOptions.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl px-2 py-2 text-[11px] font-semibold transition sm:text-[12px]",
              active ? option.active : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
