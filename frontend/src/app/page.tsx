"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Flame,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
} from "lucide-react";

import { CompletionModal } from "@/components/completion-modal";
import { HabitFormModal } from "@/components/habit-form-modal";
import { HabitRow } from "@/components/habit-row";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useToast } from "@/components/ui/toast";
import { useClientToday } from "@/hooks/use-client-today";
import { api } from "@/lib/api";
import type {
  Category,
  CompletionStatus,
  DashboardHabit,
  DashboardResponse,
} from "@/lib/types";
import {
  addDaysISO,
  cn,
  daysWord,
  errorMessage,
  formatLongDate,
  formatShortDate,
  habitsWord,
  percent,
  toneFor,
  weekdayLabel,
} from "@/lib/utils";

function heroCopy(stats: DashboardResponse["stats"], habitCount: number) {
  if (stats.total === 0) {
    if (habitCount > 0) {
      return {
        title: "День отдыха",
        text: "На сегодня по расписанию ничего нет. Отдых — тоже часть ритма.",
      };
    }
    return {
      title: "Начните с одной привычки",
      text: "Добавьте первое маленькое действие — и отмечайте его каждый день.",
    };
  }
  if (stats.done === stats.total) {
    return {
      title: "Идеальный день",
      text: "Все привычки закрыты. Можно выдохнуть и порадоваться.",
    };
  }
  if (stats.done === 0) {
    return {
      title: "Чистый лист",
      text: "Не обязательно делать всё сразу. Начните с самого простого шага.",
    };
  }
  if (stats.done >= Math.ceil(stats.total / 2)) {
    return {
      title: "Больше половины позади",
      text: "Хороший темп. Осталось совсем немного — не сбавляйте шаг.",
    };
  }
  return {
    title: "Хорошее начало",
    text: "Каждая отметка — маленькая победа. Продолжайте в своём ритме.",
  };
}

export default function DashboardPage() {
  const today = useClientToday();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [noteHabit, setNoteHabit] = useState<DashboardHabit | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const date = selectedDate ?? today;

  const { toast } = useToast();
  const { data, error, mutate } = useSWR<DashboardResponse>(
    date ? `/api/dashboard?date=${date}` : null,
  );
  const { data: categories } = useSWR<Category[]>("/api/categories");

  async function setStatus(habit: DashboardHabit, status: CompletionStatus | null) {
    if (!date) {
      return;
    }

    setPendingId(habit.id);

    try {
      if (status === null) {
        await api.deleteCompletion(habit.id, date);
      } else {
        await api.saveCompletion({
          habitId: habit.id,
          date,
          status,
          note: habit.completion?.note ?? "",
        });
      }

      await mutate();

      if (status === "done") {
        toast("Отлично! Привычка закрыта");
      } else if (status === "skipped") {
        toast("День отмечен как пропущенный", "info");
      } else {
        toast("Отметка убрана", "info");
      }
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setPendingId(null);
    }
  }

  function openNote(habit: DashboardHabit) {
    setNoteHabit(habit);
    setNoteOpen(true);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20">
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="Не удалось загрузить день"
          description={errorMessage(error)}
          action={
            <Button onClick={() => mutate()}>
              <Loader2 size={16} /> Попробовать снова
            </Button>
          }
        />
      </div>
    );
  }

  if (!date || !data) {
    return <DashboardSkeleton />;
  }

  const isToday = date === today;
  const canGoNext = Boolean(today && date < today);
  const stats = data.stats;
  const copy = heroCopy(stats, data.habits.length);
  const dayProgress = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;

  const groups: Array<{ id: number; name: string; habits: DashboardHabit[] }> = [];
  for (const habit of data.habits) {
    let group = groups.find((item) => item.id === habit.categoryId);
    if (!group) {
      group = { id: habit.categoryId, name: habit.categoryName, habits: [] };
      groups.push(group);
    }
    group.habits.push(habit);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Трекер привычек</p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.02] text-ink sm:text-5xl">
            {isToday ? "Сегодня" : weekdayLabel(date)}
          </h1>
          <p className="mt-2 text-sm text-muted">{formatLongDate(date)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-surface p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysISO(date, -1))}
              aria-label="Предыдущий день"
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-ink transition hover:bg-cream"
              title="Вернуться к сегодняшнему дню"
            >
              <CalendarDays size={15} className="text-forest" />
              {isToday ? "Сегодня" : formatShortDate(date)}
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysISO(date, 1))}
              disabled={!canGoNext}
              aria-label="Следующий день"
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <Button onClick={() => setFormOpen(true)}>
            <Plus size={17} /> Привычка
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-forest-solid to-forest-deep p-6 text-ivory shadow-card sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-ivory/10" />
          <div className="pointer-events-none absolute -right-6 top-16 h-36 w-36 rounded-full border border-ivory/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-ivory/5" />

          <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <span className="inline-flex items-center gap-2 rounded-full border border-ivory/15 bg-ivory/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ivory/75">
                <Sparkles size={12} className="text-gold" />
                {stats.total === 0
                  ? "На сегодня отдых"
                  : stats.remaining > 0
                    ? `${stats.remaining} ${habitsWord(stats.remaining)} впереди`
                    : "Все отметки на месте"}
              </span>

              <h2 className="mt-4 font-display text-[30px] leading-[1.12] sm:text-[34px]">
                {copy.title}
              </h2>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ivory/65 sm:text-sm">
                {copy.text}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ivory/10 bg-ivory/10 px-3 py-1.5 text-[11px] font-semibold text-ivory/85">
                  <Flame size={13} className="text-gold" />
                  {stats.bestStreak} {daysWord(stats.bestStreak)} — лучшая серия
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ivory/10 bg-ivory/10 px-3 py-1.5 text-[11px] font-semibold text-ivory/85">
                  <Target size={13} className="text-gold" />
                  {percent(stats.rate30)} за 30 дней
                </span>
              </div>
            </div>

            <ProgressRing done={stats.done} total={stats.total} size={158} className="self-center" />
          </div>
        </section>

        <aside className="flex flex-col justify-between rounded-[32px] border border-line bg-surface p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Осталось сегодня</p>
              <p className="mt-3 font-display text-6xl leading-none text-ink">{stats.remaining}</p>
              <p className="mt-2 text-[13px] text-muted">
                {habitsWord(stats.remaining)} {stats.remaining === 1 ? "ждёт" : "ждут"} отметки
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-soft text-forest">
              <TrendingUp size={21} />
            </span>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-muted">Прогресс дня</span>
              <span className="text-forest">{Math.round(dayProgress)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-forest transition-[width] duration-500"
                style={{ width: `${dayProgress}%` }}
              />
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-line/80 pt-5">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Готово
              </dt>
              <dd className="mt-1 font-display text-2xl leading-none text-forest">{stats.done}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Пропуск
              </dt>
              <dd className="mt-1 font-display text-2xl leading-none text-clay">{stats.skipped}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                По плану
              </dt>
              <dd className="mt-1 font-display text-2xl leading-none text-ink">{stats.total}</dd>
            </div>
          </dl>
        </aside>
      </div>

      {data.habits.length === 0 ? (
        <EmptyState
          icon={<Sprout size={26} />}
          title="Пока ни одной привычки"
          description="Начните с чего-то посильного: стакан воды, десять минут прогулки или одна страница книги. Маленький шаг важнее идеального плана."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Создать первую привычку
            </Button>
          }
        />
      ) : (
        <div className="space-y-7">
          {groups.map((group, groupIndex) => {
            const tone = toneFor(group.id);
            const planned = group.habits.filter((habit) => habit.due !== false);
            const doneCount = planned.filter(
              (habit) => habit.completion?.status === "done",
            ).length;

            return (
              <section
                key={group.id}
                className="space-y-3 animate-fade-up"
                style={{ animationDelay: `${groupIndex * 55}ms` }}
              >
                <div className="flex items-center justify-between gap-4 px-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", tone.dot)} />
                    <h2 className="truncate font-display text-2xl leading-none text-ink">
                      {group.name}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
                    {planned.length > 0 ? `${doneCount}/${planned.length}` : "отдых"}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {group.habits.map((habit) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      date={date}
                      today={today ?? data.date}
                      pending={pendingId === habit.id}
                      onSetStatus={setStatus}
                      onOpenNote={openNote}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[24px] border border-line/80 bg-surface/60 px-5 py-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CircleSlash size={13} className="text-clay" /> Пропуск — тоже часть пути
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flame size={13} className="text-gold" /> Серия растёт за выполненные дни подряд
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={13} className="text-muted/60" /> Бледная галочка — отдых после выполненного дня
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus size={13} className="text-muted/60" /> Тире — день отдыха без выполненного планового дня
        </span>
      </div>

      <HabitFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        categories={categories ?? []}
      />

      <CompletionModal
        habit={noteHabit}
        date={date}
        open={noteOpen}
        onClose={() => {
          setNoteOpen(false);
          setNoteHabit(null);
        }}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-12 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40 rounded-full" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <Skeleton className="h-[260px] rounded-[32px] bg-forest/20" />
        <Skeleton className="h-[260px] rounded-[32px]" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-[86px] rounded-[24px]" />
        <Skeleton className="h-[86px] rounded-[24px]" />
        <Skeleton className="h-[86px] rounded-[24px]" />
      </div>
    </div>
  );
}
