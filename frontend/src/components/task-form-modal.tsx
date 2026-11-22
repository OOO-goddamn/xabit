"use client";

import { useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PriorityPicker } from "@/components/priority-picker";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import type { Task, TaskPriority } from "@/lib/types";
import { cn, errorMessage, formatLongDate, todayISO } from "@/lib/utils";

export function TaskFormModal({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
}) {
  if (!open) {
    return null;
  }

  return <TaskDialog key={task?.id ?? "new"} onClose={onClose} task={task ?? null} />;
}

function TaskDialog({ onClose, task }: { onClose: () => void; task: Task | null }) {
  const today = todayISO();
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
  const [dueDate, setDueDate] = useState(task ? (task.dueDate ?? "") : today);
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Введите название задачи");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const input = {
        title: trimmed,
        note: note.trim(),
        priority,
        dueDate: dueDate || null,
        dueTime: dueDate ? dueTime : "",
        done: task?.done ?? false,
      };

      if (task) {
        await api.updateTask(task.id, input);
      } else {
        await api.createTask(input);
      }

      await revalidate();
      toast(task ? "Задача обновлена" : "Задача добавлена");
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) {
          onClose();
        }
      }}
      title={task ? "Редактировать задачу" : "Новая задача"}
      description={
        task
          ? "Измените название, описание, приоритет или дату."
          : "Разовое дело: короткое название, детали в описании и дата, если она важна."
      }
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Название" htmlFor="task-title" hint={`${title.length}/200`}>
          <Input
            id="task-title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, записаться к врачу"
            autoFocus
          />
        </Field>

        <Field label="Описание" htmlFor="task-note" hint={`${note.length}/2000`}>
          <Textarea
            id="task-note"
            value={note}
            maxLength={2000}
            rows={4}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Детали, ссылки, что учесть"
          />
        </Field>

        <Field label="Приоритет">
          <PriorityPicker value={priority} onChange={setPriority} disabled={saving} />
        </Field>

        <Field label="Дата и время" hint="Время можно не указывать">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                aria-label="Дата задачи"
                onChange={(event) => {
                  const next = event.target.value;
                  setDueDate(next);
                  if (!next) {
                    setDueTime("");
                  }
                }}
              />
              <Input
                type="time"
                value={dueTime}
                disabled={!dueDate}
                aria-label="Время задачи"
                title={dueDate ? "Время задачи" : "Сначала выберите дату"}
                onChange={(event) => setDueTime(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setDueDate(today)}
                className={cn(
                  "rounded-full px-2.5 py-1 transition",
                  dueDate === today ? "bg-forest-soft text-forest" : "text-muted hover:text-ink",
                )}
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={() => {
                  setDueDate("");
                  setDueTime("");
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 transition",
                  dueDate === "" ? "bg-forest-soft text-forest" : "text-muted hover:text-ink",
                )}
              >
                Без даты
              </button>
              {dueDate ? (
                <span className="ml-auto text-muted">
                  {formatLongDate(dueDate)}
                  {dueTime ? `, ${dueTime}` : ""}
                </span>
              ) : null}
            </div>
          </div>
        </Field>

        {error ? (
          <p role="alert" className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : task ? (
              <Save size={16} />
            ) : (
              <Plus size={16} />
            )}
            {task ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
