"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CircleSlash,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/empty-state";
import type { StatsHabit, StatsResponse } from "@/lib/types";
import {
  cn,
  dayNumber,
  daysWord,
  errorMessage,
  formatShortDate,
  weekdayShort,
} from "@/lib/utils";

const ranges = [7, 30, 90] as const;

export default function StatsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, error, mutate } = useSWR<StatsResponse>(`/api/stats?days=${days}`);

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20">
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="Не удалось загрузить статистику"
          description={errorMessage(error)}
          action={<Button onClick={() => mutate()}>Попробовать снова</Button>}
        />
      </div>
    );
  }

  if (!data) {
    return <StatsSkeleton />;
  }

  const { totals } = data;
  const bestStreak = data.habits.reduce((max, habit) => Math.max(max, habit.streak), 0);
  const recent = data.daily.slice(-Math.min(data.days, 14));
  const sorted = [...data.habits].sort((a, b) => b.rate - a.rate || b.done - a.done);
  const split = Math.ceil(sorted.length / 2);
  const strong = sorted.slice(0, Math.min(split, 4));
  const attention = sorted.slice(split).reverse().slice(0, 4);

  const cards = [
    {
      label: "Выполнено",
      value: totals.done,
      hint: `из ${totals.possible} возможных`,
      icon: Check,
      iconClass: "bg-forest-soft text-forest",
    },
    {
      label: "Пропущено",
      value: totals.skipped,
      hint: "осознанные паузы",
      icon: CircleSlash,
      iconClass: "bg-clay-soft text-clay",
    },
    {
      label: "Выполняемость",
      value: `${Math.round(totals.rate)}%`,
      hint: `за ${data.days} ${daysWord(data.days)}`,
      icon: Target,
      iconClass: "bg-gold-soft text-gold-ink",
    },
    {
      label: "Лучшая серия",
      value: bestStreak,
      hint: `${daysWord(bestStreak)} подряд`,
      icon: Flame,
      iconClass: "bg-gold-soft text-gold-ink",
    },
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Динамика</p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.02] text-ink sm:text-5xl">
            Статистика
          </h1>
          <p className="mt-2 text-sm text-muted">
            {formatShortDate(data.from, true)} — {formatShortDate(data.to, true)}
          </p>
        </div>

        <div
          role="group"
          aria-label="Период статистики"
          className="flex items-center rounded-full border border-line bg-surface p-1 shadow-sm"
        >
          {ranges.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              aria-pressed={days === range}
              className={cn(
                "h-9 rounded-full px-4 text-[12px] font-semibold transition",
                days === range
                  ? "bg-forest-solid text-ivory shadow-sm"
                  : "text-muted hover:bg-cream hover:text-ink",
              )}
            >
              {range} дней
            </button>
          ))}
        </div>
      </header>

      {data.habits.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={26} />}
          title="Статистике пока не из чего складываться"
          description="Создайте первую привычку и отметьте её — здесь появится ритм, серии и карта прогресса."
          action={
            <Link href="/habits" className={buttonStyles()}>
              <Sparkles size={16} /> Перейти к привычкам
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, index) => (
              <article
                key={card.label}
                className="rounded-[26px] border border-line bg-surface p-5 shadow-[0_1px_0_rgba(23,51,42,0.02)] animate-fade-up"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold text-muted">{card.label}</p>
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl",
                      card.iconClass,
                    )}
                  >
                    <card.icon size={17} />
                  </span>
                </div>
                <p className="mt-4 font-display text-[40px] leading-none text-ink">{card.value}</p>
                <p className="mt-2 text-[11px] text-muted">{card.hint}</p>
              </article>
            ))}
          </div>

          <section className="rounded-[28px] border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Ритм</p>
                <h2 className="mt-1 font-display text-2xl text-ink">Последние дни</h2>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-forest" /> Выполнено
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-clay/60" /> Пропущено
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-end gap-1.5 sm:gap-2">
              {recent.map((day) => {
                const doneShare = day.possible > 0 ? (day.done / day.possible) * 100 : 0;
                const skippedShare = day.possible > 0 ? (day.skipped / day.possible) * 100 : 0;
                const isToday = day.date === data.to;

                return (
                  <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="text-[9px] font-semibold uppercase text-muted/60">
                      {weekdayShort(day.date)}
                    </span>
                    <div
                      className="relative h-28 w-full max-w-10 overflow-hidden rounded-lg bg-cream"
                      title={`${formatShortDate(day.date)}: ${day.done} выполнено, ${day.skipped} пропущено`}
                    >
                      <div
                        className="absolute inset-x-0 bottom-0 bg-forest transition-all duration-500"
                        style={{ height: `${doneShare}%` }}
                      />
                      <div
                        className="absolute inset-x-0 bg-clay/55 transition-all duration-500"
                        style={{ bottom: `${doneShare}%`, height: `${skippedShare}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        isToday ? "text-forest" : "text-muted",
                      )}
                    >
                      {dayNumber(day.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Карта ритма</p>
                <h2 className="mt-1 font-display text-2xl text-ink">История по привычкам</h2>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-forest" /> Выполнено
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-clay/50" /> Пропущено
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-line/70" /> Нет отметки
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-line bg-transparent" />{" "}
                  Не по расписанию
                </span>
              </div>
            </div>

            <div className="no-scrollbar mt-6 overflow-x-auto pb-1">
              <div className="min-w-[680px] space-y-1" style={{ minWidth: Math.max(680, data.days * 12 + 250) }}>
                {data.habits.map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center gap-4 border-t border-line/60 py-2.5 first:border-t-0"
                  >
                    <div className="w-40 shrink-0">
                      <p className="truncate text-[13px] font-semibold text-ink">{habit.name}</p>
                      <p className="truncate text-[10px] uppercase tracking-wide text-muted">
                        {habit.categoryName}
                      </p>
                    </div>

                    <div className="flex flex-1 gap-[3px]">
                      {habit.history.map((day) => {
                        const offDay = day.due === false && !day.status;

                        return (
                          <span
                            key={day.date}
                            title={`${formatShortDate(day.date)}: ${
                              day.status === "done"
                                ? "выполнено"
                                : day.status === "skipped"
                                  ? "пропущено"
                                  : offDay
                                    ? "не по расписанию"
                                    : "нет отметки"
                            }`}
                            className={cn(
                              "h-4 flex-1 rounded-[3px] transition hover:opacity-70",
                              day.status === "done" && "bg-forest",
                              day.status === "skipped" && "bg-clay/50",
                              !day.status && !offDay && "bg-line/60",
                              offDay &&
                                "border border-dashed border-line/70 bg-transparent",
                              day.date === data.to && "ring-1 ring-forest/50 ring-offset-1",
                            )}
                          />
                        );
                      })}
                    </div>

                    <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-muted">
                      {Math.round(habit.rate)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <HabitRanking
              title="Сильные привычки"
              subtitle="Лучше всего держат ритм"
              habits={strong}
              tone="forest"
              icon={<Trophy size={18} />}
            />
            {attention.length > 0 ? (
              <HabitRanking
                title="Зона роста"
                subtitle="Здесь поможет маленький шаг"
                habits={attention}
                tone="clay"
                icon={<TrendingUp size={18} />}
              />
            ) : (
              <div className="flex flex-col justify-between rounded-[28px] border border-line bg-surface p-5 shadow-card sm:p-6">
                <div className="flex items-center gap-2 text-forest">
                  <Sparkles size={18} />
                  <h2 className="font-display text-xl text-ink">Всё в ритме</h2>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  За выбранный период не нашлось привычек, которым нужна поддержка.
                  Продолжайте в том же духе — и не забывайте про отдых.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HabitRanking({
  title,
  subtitle,
  habits,
  tone,
  icon,
}: {
  title: string;
  subtitle: string;
  habits: StatsHabit[];
  tone: "forest" | "clay";
  icon: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={tone === "forest" ? "text-forest" : "text-clay"}>{icon}</span>
            <h2 className="font-display text-xl text-ink">{title}</h2>
          </div>
          <p className="mt-1 text-[11px] text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {habits.map((habit) => (
          <div key={habit.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[13px] font-semibold text-ink">{habit.name}</p>
              <span className="shrink-0 text-[11px] font-semibold text-muted">
                {habit.done} · {Math.round(habit.rate)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/60">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  tone === "forest" ? "bg-forest" : "bg-clay",
                )}
                style={{ width: `${Math.max(habit.rate, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-11 w-52 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[150px] rounded-[26px]" />
        ))}
      </div>
      <Skeleton className="h-[240px] rounded-[28px]" />
      <Skeleton className="h-[320px] rounded-[28px]" />
    </div>
  );
}
