"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  Flame,
  Pencil,
  Plus,
  Search,
  Sprout,
  Target,
  Trash2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HabitFormModal } from "@/components/habit-form-modal";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { WeekDots } from "@/components/week-dots";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import { scheduleLabel } from "@/lib/schedule";
import type { Category, DashboardHabit, DashboardResponse } from "@/lib/types";
import {
  cn,
  errorMessage,
  habitsWord,
  toneFor,
} from "@/lib/utils";

function FilterChip({
  active,
  onClick,
  children,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-all",
        active
          ? "border-forest-solid bg-forest-solid text-ivory shadow-sm"
          : "border-line bg-surface text-muted hover:border-forest/30 hover:text-ink",
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dot)} /> : null}
      {children}
    </button>
  );
}

function HabitsContent({ initialFilter }: { initialFilter: number | null }) {
  const [filter, setFilter] = useState<number | null>(initialFilter);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardHabit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardHabit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  const { data, error, mutate } = useSWR<DashboardResponse>("/api/dashboard");
  const { data: categories } = useSWR<Category[]>("/api/categories");

  const filtered = useMemo(() => {
    const habits = data?.habits ?? [];
    const normalized = query.trim().toLowerCase();

    return habits.filter((habit) => {
      const matchesCategory = filter === null || habit.categoryId === filter;
      const matchesQuery =
        normalized === "" ||
        habit.name.toLowerCase().includes(normalized) ||
        habit.description.toLowerCase().includes(normalized) ||
        habit.categoryName.toLowerCase().includes(normalized);

      return matchesCategory && matchesQuery;
    });
  }, [data?.habits, filter, query]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(habit: DashboardHabit) {
    setEditing(habit);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    try {
      await api.deleteHabit(deleteTarget.id);
      await revalidate();
      toast("Привычка удалена");
      setDeleteTarget(null);
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20">
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="Не удалось загрузить привычки"
          description={errorMessage(error)}
          action={<Button onClick={() => mutate()}>Попробовать снова</Button>}
        />
      </div>
    );
  }

  if (!data) {
    return <HabitsSkeleton />;
  }

  const total = data.habits.length;
  const selectedCategory = categories?.find((category) => category.id === filter);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Коллекция</p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.02] text-ink sm:text-5xl">
            Привычки
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            {total > 0
              ? `${total} ${habitsWord(total)} в ${categories?.length ?? 0} категориях. Выберите те, что важны сейчас.`
              : "Здесь появится список ваших ежедневных шагов."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={17} /> Новая привычка
        </Button>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterChip active={filter === null} onClick={() => setFilter(null)}>
            Все <span className="opacity-60">{total}</span>
          </FilterChip>
          {categories?.map((category) => {
            const tone = toneFor(category.id);
            return (
              <FilterChip
                key={category.id}
                active={filter === category.id}
                onClick={() => setFilter(filter === category.id ? null : category.id)}
                dot={filter === category.id ? "bg-ivory" : tone.dot}
              >
                {category.name} <span className="opacity-60">{category.habitCount}</span>
              </FilterChip>
            );
          })}
        </div>

        <div className="relative w-full lg:w-64">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти привычку"
            className="h-10 rounded-full pl-9"
            aria-label="Поиск привычки"
          />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<Sprout size={26} />}
          title="Коллекция пока пуста"
          description="Добавьте привычку, которую хочется закрепить. Начните с одного действия, которое займёт не больше пяти минут."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} /> Создать привычку
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={24} />}
          title="Ничего не нашлось"
          description={
            selectedCategory
              ? `В категории «${selectedCategory.name}» нет подходящих привычек. Попробуйте изменить фильтр или поисковый запрос.`
              : "Попробуйте изменить поисковый запрос или выбрать другую категорию."
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setFilter(null);
                setQuery("");
              }}
            >
              Сбросить фильтры
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((habit, index) => {
            const tone = toneFor(habit.categoryId);
            const status = habit.completion?.status;
            const due = habit.due !== false;
            const target = habit.targetValue ?? 0;
            const isQuantity = target > 0;
            const value = habit.completion?.value ?? 0;

            return (
              <article
                key={habit.id}
                className="group flex flex-col rounded-[26px] border border-line bg-surface p-5 shadow-[0_1px_0_rgba(23,51,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-forest/20 hover:shadow-card animate-fade-up"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                      tone.soft,
                      tone.text,
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                    {habit.categoryName}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(habit)}
                      aria-label={`Редактировать привычку «${habit.name}»`}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(habit)}
                      aria-label={`Удалить привычку «${habit.name}»`}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-clay-soft hover:text-clay"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h2 className="mt-4 font-display text-[25px] leading-[1.15] text-ink">
                  {habit.name}
                </h2>
                <p className="mt-2 line-clamp-2 min-h-10 text-[13px] leading-relaxed text-muted">
                  {habit.description || "Без описания"}
                </p>

                {habit.repeat !== "daily" ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                    <CalendarDays size={11} />
                    {scheduleLabel(habit)}
                  </p>
                ) : null}

                {isQuantity ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold-ink">
                    <Target size={11} />
                    {target} {habit.unit || "ед."} в день
                    {habit.stepValue > 1 ? ` · шаг ${habit.stepValue}` : ""}
                  </p>
                ) : null}

                {habit.reminderTime ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-forest">
                    <BellRing size={11} />
                    Напоминание в {habit.reminderTime}
                  </p>
                ) : null}

                <div className="mt-auto pt-5">
                  <div className="flex items-end justify-between gap-3">
                    <WeekDots
                      week={habit.week}
                      today={data.date}
                      compact
                      target={habit.targetValue}
                      unit={habit.unit}
                    />
                    {habit.streak > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold text-gold-ink"
                        title="Текущая серия"
                      >
                        <Flame size={11} className="text-gold" />
                        {habit.streak}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line/70 pt-3 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          !due
                            ? "bg-line/50"
                            : status === "done"
                              ? "bg-forest"
                              : status === "progress"
                                ? "bg-gold"
                                : status === "skipped"
                                  ? "bg-clay"
                                  : "bg-line",
                        )}
                      />
                      {!due && !status
                        ? "Сегодня не по расписанию"
                        : status === "done"
                          ? "Сегодня выполнено"
                          : status === "progress"
                            ? `Сегодня ${value} из ${target} ${habit.unit || "ед."}`
                            : status === "skipped"
                              ? "Сегодня пропущено"
                              : "Сегодня без отметки"}
                    </span>
                    <span>{habit.done30} за 30 дней</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <HabitFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        categories={categories ?? []}
        habit={editing}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Удалить привычку?"
        description={
          deleteTarget
            ? `Привычка «${deleteTarget.name}» и вся история её отметок будут удалены безвозвратно.`
            : ""
        }
      />
    </div>
  );
}

function HabitsSkeleton() {
  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[230px] rounded-[26px]" />
        ))}
      </div>
    </div>
  );
}

function HabitsRoute() {
  const searchParams = useSearchParams();
  const rawCategory = searchParams.get("category");
  const parsed = rawCategory ? Number(rawCategory) : Number.NaN;
  const initialFilter = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  return (
    <HabitsContent
      key={rawCategory ?? "all"}
      initialFilter={initialFilter}
    />
  );
}

export default function HabitsPage() {
  return (
    <Suspense fallback={<HabitsSkeleton />}>
      <HabitsRoute />
    </Suspense>
  );
}
