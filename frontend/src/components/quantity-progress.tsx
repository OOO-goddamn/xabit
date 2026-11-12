"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export function QuantityProgress({
  value,
  target,
  unit,
  step,
  disabled,
  onChange,
}: {
  value: number;
  target: number;
  unit: string;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const safeStep = Math.max(1, step || 1);
  const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const reached = value >= target;

  function commit() {
    const parsed = Math.round(Number(draft));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      return;
    }
    if (parsed === value) {
      setDraft(String(value));
      return;
    }
    onChange(parsed);
  }

  return (
    <div className="mt-2 w-full max-w-sm space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold">
        <span className={reached ? "text-forest" : value > 0 ? "text-gold-ink" : "text-muted"}>
          {value}
          <span className="text-muted">
            {" "}
            / {target} {unit}
          </span>
        </span>
        <span className={reached ? "text-forest" : "text-gold-ink"}>{percent}%</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-line/60">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            reached ? "bg-forest" : "bg-gold",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - safeStep))}
          title={`Убрать ${safeStep}${unit ? ` ${unit}` : ""}`}
          aria-label={`Уменьшить на ${safeStep}`}
          className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-muted transition hover:border-forest/30 hover:text-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={12} strokeWidth={2.6} />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={safeStep}
          value={draft}
          disabled={disabled}
          aria-label="Точное значение за день"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDraft(String(value));
              event.currentTarget.blur();
            }
          }}
          className="h-7 w-16 rounded-full border border-line bg-cream/70 px-2 text-center text-[12px] font-semibold text-ink outline-none transition focus:border-forest/40 focus:bg-surface focus:ring-2 focus:ring-forest/10 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(value + safeStep)}
          title={`Добавить ${safeStep}${unit ? ` ${unit}` : ""}`}
          aria-label={`Добавить ${safeStep}`}
          className="inline-flex h-7 items-center gap-0.5 rounded-full border border-line bg-surface px-2 text-[11px] font-semibold text-muted transition hover:border-forest/30 hover:text-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={11} strokeWidth={2.8} />
          {safeStep}
        </button>
      </div>
    </div>
  );
}
