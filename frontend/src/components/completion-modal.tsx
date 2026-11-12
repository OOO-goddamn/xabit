"use client";

import { useState } from "react";
import { Check, CircleSlash, Loader2, Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
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
  const [amount, setAmount] = useState(String(habit.completion?.value ?? 0));
  const [skipped, setSkipped] = useState(habit.completion?.status === "skipped");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = habit.targetValue ?? 0;
  const isQuantity = target > 0;
  const step = Math.max(1, habit.stepValue || 1);
  const parsedAmount = Math.max(0, Math.round(Number(amount) || 0));

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  function adjustAmount(delta: number) {
    setSkipped(false);
    setAmount(String(Math.max(0, parsedAmount + delta)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      if (isQuantity) {
        if (!skipped && parsedAmount <= 0) {
          if (habit.completion) {
            await api.deleteCompletion(habit.id, date);
            toast("Отметка убрана", "info");
          }
          await revalidate();
          onClose();
          return;
        }

        await api.saveCompletion({
          habitId: habit.id,
          date,
          status: skipped ? "skipped" : parsedAmount >= target ? "done" : "progress",
          value: skipped ? 0 : parsedAmount,
          note: note.trim(),
        });
        await revalidate();

        if (skipped) {
          toast("День пропущен");
        } else if (parsedAmount >= target) {
          toast("Цель достигнута — привычка закрыта");
        } else {
          toast("Прогресс сохранён", "info");
        }
        onClose();
        return;
      }

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
        {isQuantity ? (
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">Сколько сделано?</p>
              <p className="mt-1 text-[11px] text-muted">
                Цель: {target} {habit.unit}. Частичный прогресс сохранится, но серия вырастет
                только при достижении цели.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => adjustAmount(-step)}
                disabled={skipped || parsedAmount <= 0}
                aria-label={`Уменьшить на ${step}`}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-cream text-muted transition hover:border-forest/30 hover:text-forest disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus size={15} strokeWidth={2.6} />
              </button>

              <Input
                type="number"
                min={0}
                step={step}
                inputMode="numeric"
                value={amount}
                disabled={skipped}
                aria-label="Сколько сделано"
                onChange={(event) => {
                  setSkipped(false);
                  setAmount(event.target.value);
                }}
                className="h-10 w-24 text-center font-semibold"
              />
              {habit.unit ? (
                <span className="text-[13px] font-semibold text-muted">{habit.unit}</span>
              ) : null}

              <button
                type="button"
                onClick={() => adjustAmount(step)}
                disabled={skipped}
                aria-label={`Добавить ${step}`}
                className="inline-flex h-10 items-center gap-1 rounded-full border border-line bg-cream px-3 text-[12px] font-semibold text-muted transition hover:border-forest/30 hover:text-forest disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} strokeWidth={2.8} />
                {step}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSkipped((current) => !current)}
                aria-pressed={skipped}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-[12px] font-semibold transition",
                  skipped
                    ? "border-clay bg-clay text-white shadow-sm dark:text-paper"
                    : "border-line bg-cream text-muted hover:border-clay/30 hover:text-ink",
                )}
              >
                <CircleSlash size={14} />
                Пропустить день
              </button>
              {!skipped ? (
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    parsedAmount >= target ? "text-forest" : "text-gold-ink",
                  )}
                >
                  {parsedAmount >= target
                    ? "Цель достигнута — день будет засчитан"
                    : `${Math.max(0, target - parsedAmount)} ${habit.unit || "ед."} до цели`}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
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
        )}

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
