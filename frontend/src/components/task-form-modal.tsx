"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import { cn, errorMessage, formatLongDate, todayISO } from "@/lib/utils";

export function TaskFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) {
    return null;
  }

  return <TaskDialog onClose={onClose} />;
}

function TaskDialog({ onClose }: { onClose: () => void }) {
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState(today);
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
      await api.createTask({
        title: trimmed,
        note: note.trim(),
        dueDate: dueDate || null,
        done: false,
      });
      await revalidate();
      toast("Задача добавлена");
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
      onClose={onClose}
      title="Новая задача"
      description="Разовое дело: короткое название, детали в описании и дата, если она важна."
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

        <Field label="Дата" htmlFor="task-date" hint="Можно оставить без даты">
          <div className="space-y-2">
            <Input
              id="task-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
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
                onClick={() => setDueDate("")}
                className={cn(
                  "rounded-full px-2.5 py-1 transition",
                  dueDate === "" ? "bg-forest-soft text-forest" : "text-muted hover:text-ink",
                )}
              >
                Без даты
              </button>
              {dueDate ? (
                <span className="ml-auto text-muted">{formatLongDate(dueDate)}</span>
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
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Создать
          </Button>
        </div>
      </form>
    </Modal>
  );
}
