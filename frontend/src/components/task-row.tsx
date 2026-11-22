"use client";

import { useState } from "react";
import { CalendarDays, Check, Loader2, Pencil, Trash2, X } from "lucide-react";

import { SortControls } from "@/components/sort-controls";
import { PriorityPicker, priorityLabel } from "@/components/priority-picker";
import { Input, Textarea } from "@/components/ui/field";
import type { Task, TaskInput, TaskPriority } from "@/lib/types";
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
  onSave,
  onDelete,
  sortControls,
}: {
  task: Task;
  today: string;
  pending: boolean;
  onToggle: (task: Task) => void;
  onSave: (task: Task, input: TaskInput) => Promise<void>;
  onDelete: (task: Task) => void;
  sortControls?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    disabled: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [saving, setSaving] = useState(false);

  const overdue = Boolean(task.dueDate && task.dueDate < today && !task.done);

  function startEditing() {
    setTitle(task.title);
    setNote(task.note);
    setPriority(task.priority);
    setDueDate(task.dueDate ?? "");
    setEditing(true);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    setSaving(true);
    try {
      await onSave(task, {
        title: trimmed,
        note: note.trim(),
        priority,
        dueDate: dueDate || null,
        done: task.done,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-forest/25 bg-surface p-3 shadow-sm"
      >
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            value={title}
            maxLength={200}
            aria-label="Название задачи"
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
          <Input
            type="date"
            value={dueDate}
            aria-label="Дата задачи"
            onChange={(event) => setDueDate(event.target.value)}
            className="sm:w-40"
          />
        </div>
        <div className="mt-2">
          <PriorityPicker value={priority} onChange={setPriority} disabled={saving} />
        </div>
        <div className="mt-2">
          <Textarea
            value={note}
            maxLength={2000}
            rows={3}
            aria-label="Описание задачи"
            placeholder="Описание: детали, ссылки, что учесть"
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">{note.length}/2000</span>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
              aria-label="Отменить редактирование"
              title="Отмена"
            >
              <X size={15} />
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-forest-solid px-3 text-[12px] font-semibold text-ivory transition hover:bg-forest-deep disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Сохранить
            </button>
          </div>
        </div>
      </form>
    );
  }

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
          onClick={startEditing}
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
