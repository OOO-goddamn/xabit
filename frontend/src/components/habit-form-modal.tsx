"use client";

import { useState } from "react";
import { BellRing, FolderPlus, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import { REPEAT_OPTIONS, WEEKDAY_OPTIONS, monthDayLabel } from "@/lib/schedule";
import type { Category, Habit, RepeatType } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }
  if (Notification.permission !== "default") {
    return;
  }
  try {
    await Notification.requestPermission();
  } catch {
    // The reminder still shows in-app when the browser blocks notifications.
  }
}

export function HabitFormModal({
  open,
  onClose,
  categories,
  habit,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  habit?: Habit | null;
}) {
  if (!open) {
    return null;
  }

  return (
    <HabitDialog
      onClose={onClose}
      categories={categories}
      habit={habit ?? null}
    />
  );
}

function HabitDialog({
  onClose,
  categories,
  habit,
}: {
  onClose: () => void;
  categories: Category[];
  habit: Habit | null;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [categoryId, setCategoryId] = useState(habit?.categoryId ?? categories[0]?.id ?? 0);
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? "");
  const [repeat, setRepeat] = useState<RepeatType>(habit?.repeat ?? "daily");
  const [weekdays, setWeekdays] = useState<number[]>(() =>
    [...(habit?.weekdays ?? [])].sort((a, b) => a - b),
  );
  const [monthDay, setMonthDay] = useState(habit?.monthDay ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCategoryId = categoryId || categories[0]?.id || 0;

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Дайте привычке название");
      return;
    }
    if (!activeCategoryId) {
      setError("Выберите категорию");
      return;
    }
    if (repeat === "weekly" && weekdays.length === 0) {
      setError("Выберите хотя бы один день недели");
      return;
    }

    setSaving(true);
    setError(null);

    if (reminderTime) {
      await requestNotificationPermission();
    }

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        categoryId: activeCategoryId,
        reminderTime,
        repeat,
        weekdays: repeat === "weekly" ? [...weekdays].sort((a, b) => a - b) : [],
        monthDay: repeat === "monthly" ? monthDay : null,
      };

      if (habit) {
        await api.updateHabit(habit.id, payload);
        toast("Привычка обновлена");
      } else {
        await api.createHabit(payload);
        toast("Привычка создана");
      }

      await revalidate();
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
      title={habit ? "Редактировать привычку" : "Новая привычка"}
      description={
        habit
          ? "Измените название, описание, категорию, повторение или время напоминания."
          : "Небольшое действие, которое хочется повторять регулярно."
      }
    >
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-cream/60 p-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-forest-soft text-forest">
            <FolderPlus size={20} />
          </span>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Сначала создайте категорию — привычке нужно место в вашей системе.
          </p>
          <Link
            href="/categories"
            onClick={onClose}
            className="mt-4 inline-flex text-sm font-semibold text-forest underline-offset-4 hover:underline"
          >
            Перейти к категориям
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Название" htmlFor="habit-name" hint={`${name.length}/120`}>
            <Input
              id="habit-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, читать 20 страниц"
              autoFocus
            />
          </Field>

          <Field label="Категория" htmlFor="habit-category">
            <Select
              id="habit-category"
              value={activeCategoryId}
              onChange={(event) => setCategoryId(Number(event.target.value))}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Повторение"
            hint={REPEAT_OPTIONS.find((option) => option.value === repeat)?.hint}
          >
            <div
              role="group"
              aria-label="Как часто повторять привычку"
              className="grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-cream/60 p-1.5"
            >
              {REPEAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={repeat === option.value}
                  onClick={() => setRepeat(option.value)}
                  className={cn(
                    "rounded-xl px-2 py-2 text-[11px] font-semibold transition sm:text-[12px]",
                    repeat === option.value
                      ? "bg-forest-solid text-ivory shadow-sm"
                      : "text-muted hover:bg-surface hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {repeat === "weekly" ? (
              <div className="mt-2.5 grid grid-cols-7 gap-1.5">
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = weekdays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={active}
                      title={day.label}
                      onClick={() =>
                        setWeekdays((current) =>
                          active
                            ? current.filter((value) => value !== day.value)
                            : [...current, day.value].sort((a, b) => a - b),
                        )
                      }
                      className={cn(
                        "h-10 rounded-xl border text-[12px] font-semibold transition",
                        active
                          ? "border-forest-solid bg-forest-solid text-ivory shadow-sm"
                          : "border-line bg-cream/60 text-muted hover:border-forest/30 hover:text-ink",
                      )}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {repeat === "monthly" ? (
              <div className="mt-2.5 space-y-1.5">
                <Select
                  value={monthDay}
                  aria-label="День месяца"
                  onChange={(event) => setMonthDay(Number(event.target.value))}
                >
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      {monthDayLabel(day)}
                    </option>
                  ))}
                </Select>
                {monthDay > 28 ? (
                  <p className="text-[11px] leading-relaxed text-muted">
                    В коротких месяцах привычка попадёт на последний день месяца.
                  </p>
                ) : null}
              </div>
            ) : null}
          </Field>

          <Field label="Напоминание" htmlFor="habit-reminder" hint="Только в запланированные дни">
            <div className="flex items-center gap-3">
              <div className="relative">
                <BellRing
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  id="habit-reminder"
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="w-[148px] pl-9"
                />
              </div>
              {reminderTime ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReminderTime("")}
                >
                  Убрать
                </Button>
              ) : (
                <span className="text-[12px] text-muted">Без напоминания</span>
              )}
            </div>
          </Field>

          <Field
            label="Описание"
            htmlFor="habit-description"
            hint={`${description.length}/2000`}
          >
            <Textarea
              id="habit-description"
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Зачем эта привычка и как она выглядит на практике?"
            />
          </Field>

          {error ? (
            <p className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {habit ? "Сохранить" : "Создать привычку"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
