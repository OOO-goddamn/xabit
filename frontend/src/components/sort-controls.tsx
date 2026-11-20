import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function SortControls({
  label,
  canMoveUp,
  canMoveDown,
  disabled = false,
  orientation = "horizontal",
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Порядок: ${label}`}
      className={cn("flex items-center", orientation === "vertical" ? "flex-col" : "")}
    >
      <button
        type="button"
        onClick={onMoveUp}
        disabled={disabled || !canMoveUp}
        aria-label={`Переместить ${label} выше`}
        title="Переместить выше"
        className="grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronUp size={15} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={disabled || !canMoveDown}
        aria-label={`Переместить ${label} ниже`}
        title="Переместить ниже"
        className="grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronDown size={15} />
      </button>
    </div>
  );
}
