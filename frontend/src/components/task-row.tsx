"use client";

import { CalendarDays, Check, Loader2, Pencil, Trash2 } from "lucide-react";

import { priorityLabel } from "@/components/priority-picker";
import { SortControls } from "@/components/sort-controls";
import type { Task } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

function dateLabel(task: Task, today: string) {
  if (!task.dueDate) {
    return "Без даты";
  }
  if (task.dueDate === today) {
    return "Сегодня";
  }
  return formatShortDate(task.dueDate);
}

export function TaskRow({
  task,
  today,
  pending,
  onToggle,
  onEdit,
  onDelete,
  sortControls,
}: {
  task: Task;
  today: string;
  pending: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  sortControls?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    disabled: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
  };
}) {
  const overdue = Boolean(task.dueDate && task.dueDate < today && !task.done);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition",
        task.done ? "border-line/60 bg-cream/30" : "border-line bg-surface hover:border-forest/20",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={pending}
        aria-pressed={task.done}
        aria-label={task.done ? `Снять отметку с задачи «${task.title}»` : `Отметить задачу «${task.title}» выполненной`}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 transition",
          task.done
            ? "border-forest-solid bg-forest-solid text-ivory"
            : "border-line bg-cream text-muted hover:border-forest/50 hover:text-forest",
        )}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : task.done ? (
          <Check size={16} strokeWidth={3} />
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[14px] font-semibold",
            task.done ? "text-muted line-through" : "text-ink",
          )}
        >
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-semibold",
              overdue ? "text-clay" : task.dueDate === today && !task.done ? "text-forest" : "text-muted",
            )}
          >
            <CalendarDays size={11} />
            {dateLabel(task, today)}
          </span>
          {task.priority !== "normal" ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                task.priority === "high"
                  ? "bg-clay-soft text-clay"
                  : "bg-slate-soft text-slate-ink",
              )}
            >
              {priorityLabel(task.priority)}
            </span>
          ) : null}
        </div>
        {task.note ? (
          <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-[12px] leading-snug text-muted">
            {task.note}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {sortControls ? (
          <SortControls label={`задачу «${task.title}»`} orientation="vertical" {...sortControls} />
        ) : null}
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label={`Изменить задачу «${task.title}»`}
          title="Изменить"
          className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`Удалить задачу «${task.title}»`}
          title="Удалить"
          className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-clay-soft hover:text-clay"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
