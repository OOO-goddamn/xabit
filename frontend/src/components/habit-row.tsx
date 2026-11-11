"use client";

import {
  BellRing,
  CalendarDays,
  Check,
  CircleSlash,
  Flame,
  Loader2,
  Minus,
  NotebookPen,
  RotateCcw,
} from "lucide-react";

import type { CompletionStatus, DashboardHabit } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

import { WeekDots } from "./week-dots";

export function HabitRow({
  habit,
  date,
  today,
  pending,
  onSetStatus,
  onOpenNote,
}: {
  habit: DashboardHabit;
  date: string;
  today: string;
  pending: boolean;
  onSetStatus: (habit: DashboardHabit, status: CompletionStatus | null) => void;
  onOpenNote: (habit: DashboardHabit) => void;
}) {
  const status = habit.completion?.status ?? null;
  const note = habit.completion?.note ?? "";
  const isFuture = date > today;
  const due = habit.due !== false;
  const offDay = !due && !status;
  const covered = offDay && habit.covered === true;
  const disabled = pending || isFuture || offDay;
  const isDone = status === "done";
  const isSkipped = status === "skipped";

  return (
    <article
      className={cn(
        "group flex flex-col gap-3 rounded-[24px] border bg-surface p-4 shadow-[0_1px_0_rgba(23,51,42,0.02)] transition-all duration-200 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-4",
        isDone && "border-forest/25 bg-gradient-to-r from-forest-soft/55 via-surface to-surface",
        isSkipped && "border-clay/20 bg-gradient-to-r from-clay-soft/35 via-surface to-surface",
        !status && offDay && "border-dashed border-line/80 bg-cream/35 opacity-80",
        !status && !offDay && "border-line hover:border-forest/20 hover:shadow-card",
        isFuture && "opacity-80",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSetStatus(habit, isDone ? null : "done")}
          aria-pressed={isDone}
          aria-label={
            offDay
              ? covered
                ? `Привычка «${habit.name}»: сегодня отдых, предыдущий плановый день выполнен`
                : `Привычка «${habit.name}» сегодня не по расписанию`
              : isDone
                ? `Снять отметку с привычки «${habit.name}»`
                : `Отметить привычку «${habit.name}» выполненной`
          }
          title={
            offDay
              ? covered
                ? "Не по расписанию — предыдущий плановый день выполнен"
                : "Сегодня не по расписанию — отдых"
              : isFuture
                ? "Нельзя отметить будущий день"
                : undefined
          }
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-all duration-200",
            isDone &&
              "border-forest-solid bg-forest-solid text-ivory shadow-[0_8px_18px_-10px_rgba(29,92,72,0.9)]",
            isSkipped && "border-clay/30 bg-clay-soft text-clay",
            covered && "border-dashed border-forest/30 bg-forest/5 text-forest/45",
            offDay && !covered && "border-dashed border-line/80 bg-cream/40 text-muted/40",
            !status &&
              !offDay &&
              "border-line bg-cream text-muted hover:border-forest/50 hover:bg-forest-soft/60 hover:text-forest",
            disabled && "cursor-not-allowed opacity-55",
            pending && "opacity-100",
          )}
        >
          {pending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isDone ? (
            <Check size={20} strokeWidth={3} />
          ) : isSkipped ? (
            <Minus size={18} strokeWidth={3} />
          ) : covered ? (
            <Check size={20} strokeWidth={3} className="opacity-30" />
          ) : offDay ? (
            <Minus size={18} strokeWidth={3} className="opacity-40" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-line transition group-hover:bg-forest/40" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={cn(
                "truncate text-[15px] font-semibold leading-snug",
                isDone ? "text-forest" : "text-ink",
                isSkipped && "text-ink/70",
              )}
            >
              {habit.name}
            </h3>
            {habit.streak > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold text-gold-ink"
                title="Текущая серия"
              >
                <Flame size={11} className="text-gold" />
                {habit.streak}
              </span>
            ) : null}
            {isSkipped ? (
              <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[10px] font-bold text-clay">
                Пропущено
              </span>
            ) : null}
            {offDay ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-muted">
                <CalendarDays size={10} />
                Не по расписанию
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-[13px] text-muted">
            {habit.description || (offDay ? "Сегодня отдых по расписанию" : "Без описания")}
          </p>

          {habit.reminderTime && due ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-forest">
              <BellRing size={11} />
              Напоминание в {habit.reminderTime}
            </p>
          ) : null}

          {note ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] italic leading-snug text-muted">
              <NotebookPen size={12} className="mt-0.5 shrink-0 text-gold" />
              <span className="line-clamp-1">{note}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pl-14 sm:shrink-0 sm:pl-0">
        <WeekDots week={habit.week} today={today} />
        <div className="ml-auto flex items-center gap-0.5 sm:ml-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onOpenNote(habit)}
            title="Добавить заметку"
            aria-label={`Заметка к привычке «${habit.name}»`}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full transition hover:bg-ink/5 disabled:opacity-40",
              note ? "text-gold" : "text-muted",
            )}
          >
            <NotebookPen size={15} />
          </button>
          <button
            type="button"
            disabled={disabled || isSkipped}
            onClick={() => onSetStatus(habit, "skipped")}
            aria-pressed={isSkipped}
            title="Пропустить"
            aria-label={`Пропустить привычку «${habit.name}»`}
            className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-clay-soft hover:text-clay disabled:opacity-40"
          >
            <CircleSlash size={15} />
          </button>
          {status ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetStatus(habit, null)}
              title="Убрать отметку"
              aria-label={`Убрать отметку с привычки «${habit.name}»`}
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-40"
            >
              <RotateCcw size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <span className="sr-only">{formatShortDate(date)}</span>
    </article>
  );
}
