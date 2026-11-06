"use client";

import { useState } from "react";
import { Check, CircleSlash, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import type { CompletionStatus, DashboardHabit } from "@/lib/types";
import { cn, errorMessage, formatLongDate } from "@/lib/utils";

export function CompletionModal({
  habit,
  date,
  open,
  onClose,
}: {
  habit: DashboardHabit | null;
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !habit) {
    return null;
  }

  return <CompletionDialog habit={habit} date={date} onClose={onClose} />;
}

function CompletionDialog({
  habit,
  date,
  onClose,
}: {
  habit: DashboardHabit;
  date: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<CompletionStatus>(habit.completion?.status ?? "done");
  const [note, setNote] = useState(habit.completion?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      await api.saveCompletion({
        habitId: habit.id,
        date,
        status,
        note: note.trim(),
      });
      await revalidate();
      toast(status === "done" ? "Привычка отмечена" : "День пропущен");
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);

    try {
      await api.deleteCompletion(habit.id, date);
      await revalidate();
      toast("Отметка убрана");
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
      title={habit.name}
      description={`${formatLongDate(date)} · ${habit.categoryName}`}
      footer={
        <>
          {habit.completion ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto text-clay hover:bg-clay-soft hover:text-clay"
            >
              <Trash2 size={15} />
              Убрать отметку
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink">Как прошёл день?</p>
          <div role="group" aria-label="Статус выполнения" className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus("done")}
              aria-pressed={status === "done"}
              className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                status === "done"
                  ? "border-forest-solid bg-forest-solid text-ivory shadow-sm"
                  : "border-line bg-cream text-muted hover:border-forest/30 hover:text-ink",
              )}
            >
              <Check size={16} strokeWidth={2.6} />
              Выполнено
            </button>
            <button
              type="button"
              onClick={() => setStatus("skipped")}
              aria-pressed={status === "skipped"}
              className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                status === "skipped"
                  ? "border-clay bg-clay text-white shadow-sm dark:text-paper"
                  : "border-line bg-cream text-muted hover:border-clay/30 hover:text-ink",
              )}
            >
              <CircleSlash size={16} />
              Пропущено
            </button>
          </div>
        </div>

        <Field label="Заметка" hint={`${note.length}/2000`} htmlFor="completion-note">
          <Textarea
            id="completion-note"
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Как всё прошло? Что помогло или помешало?"
          />
        </Field>

        {error ? (
          <p className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">{error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
