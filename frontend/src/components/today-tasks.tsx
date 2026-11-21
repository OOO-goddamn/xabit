"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, ListTodo, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";
import { cn, errorMessage, formatShortDate } from "@/lib/utils";

export function TodayTasks({
  tasks,
  date,
  today,
  onChanged,
}: {
  tasks: Task[];
  date: string;
  today: string;
  onChanged: () => Promise<unknown> | void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const { toast } = useToast();

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    setSaving(true);
    try {
      await api.createTask({ title: trimmed, note: "", dueDate: date, done: false });
      await onChanged();
      setTitle("");
      toast("Задача добавлена");
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(task: Task) {
    setPendingId(task.id);
    try {
      await api.updateTask(task.id, {
        title: task.title,
        note: task.note,
        dueDate: task.dueDate,
        done: true,
      });
      await onChanged();
      toast("Задача выполнена");
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="rounded-[32px] border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Разовые дела</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-2xl text-ink">
            <ListTodo size={20} className="text-forest" />
            Задачи
            {tasks.length > 0 ? (
              <span className="rounded-full bg-forest-soft px-2 py-0.5 text-[11px] font-bold text-forest">
                {tasks.length}
              </span>
            ) : null}
          </h2>
        </div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-forest transition hover:gap-2.5"
        >
          Все задачи
          <ArrowRight size={13} />
        </Link>
      </div>

      {tasks.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-cream/60"
            >
              <button
                type="button"
                onClick={() => void handleToggle(task)}
                disabled={pendingId === task.id}
                aria-label={`Отметить задачу «${task.title}» выполненной`}
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition",
                  "border-line bg-cream text-muted hover:border-forest/50 hover:text-forest",
                )}
              >
                {pendingId === task.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
              </button>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                {task.title}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-muted">
                {task.dueDate === date
                  ? date === today
                    ? "Сегодня"
                    : formatShortDate(task.dueDate)
                  : "Без даты"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-cream/40 px-4 py-3 text-[12px] leading-relaxed text-muted">
          На этот день разовых дел нет. Если появится что-то, что не повторяется, — добавьте здесь.
        </p>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex gap-2">
        <Input
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Добавить задачу на этот день"
          aria-label="Новая задача на этот день"
          className="h-10"
        />
        <Button type="submit" size="sm" disabled={saving || !title.trim()} className="shrink-0">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Добавить
        </Button>
      </form>
    </section>
  );
}
