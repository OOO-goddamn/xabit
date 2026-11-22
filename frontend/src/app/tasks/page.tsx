"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, ListTodo, Plus, Sparkles } from "lucide-react";

import { TaskFormModal } from "@/components/task-form-modal";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, Skeleton } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useClientToday } from "@/hooks/use-client-today";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import type { Task, TaskInput } from "@/lib/types";
import { errorMessage, pluralRu, todayISO } from "@/lib/utils";

function tasksWord(count: number) {
  return `${count} ${pluralRu(count, "задача", "задачи", "задач")}`;
}

export default function TasksPage() {
  const clientToday = useClientToday();
  const { data, error, mutate } = useSWR<Task[]>("/api/tasks");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [sorting, setSorting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  const today = clientToday ?? todayISO();

  async function handleToggle(task: Task) {
    setPendingId(task.id);
    try {
      await api.updateTask(task.id, {
        title: task.title,
        note: task.note,
        priority: task.priority,
        dueDate: task.dueDate,
        done: !task.done,
      });
      await revalidate();
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setPendingId(null);
    }
  }

  async function handleSave(task: Task, input: TaskInput) {
    try {
      await api.updateTask(task.id, input);
      await revalidate();
      toast("Задача обновлена");
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
      throw requestError;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    try {
      await api.deleteTask(deleteTarget.id);
      await revalidate();
      toast("Задача удалена");
      setDeleteTarget(null);
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setDeleting(false);
    }
  }

  async function moveTask(group: Task[], index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= group.length) {
      return;
    }

    const ids = group.map((task) => task.id);
    [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];

    setSorting(true);
    try {
      await api.reorderTasks(ids);
      await mutate();
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setSorting(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20">
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="Не удалось загрузить задачи"
          description={errorMessage(error)}
          action={<Button onClick={() => mutate()}>Попробовать снова</Button>}
        />
      </div>
    );
  }

  if (!data || !clientToday) {
    return <TasksSkeleton />;
  }

  const active = data.filter((task) => !task.done);
  const overdue = active.filter((task) => task.dueDate && task.dueDate < today);
  const todayTasks = active.filter((task) => task.dueDate === today);
  const later = active.filter((task) => task.dueDate && task.dueDate > today);
  const undated = active.filter((task) => !task.dueDate);
  const completed = data
    .filter((task) => task.done)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const groups = [
    { key: "overdue", title: "Просрочено", hint: "Срок уже прошёл", tasks: overdue },
    { key: "today", title: "На сегодня", hint: "Планы на этот день", tasks: todayTasks },
    { key: "later", title: "Позже", hint: "Задачи с будущей датой", tasks: later },
    { key: "undated", title: "Без даты", hint: "Когда будет время", tasks: undated },
  ].filter((group) => group.tasks.length > 0);

  function renderGroup(key: string, title: string, hint: string, tasks: Task[]) {
    return (
      <section key={key} className="space-y-2.5 animate-fade-up">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="font-display text-xl leading-none text-ink">{title}</h2>
            <p className="mt-1 text-[11px] text-muted">{hint}</p>
          </div>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
            {tasks.length}
          </span>
        </div>

        <div className="space-y-2">
          {tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              pending={pendingId === task.id}
              onToggle={(item) => void handleToggle(item)}
              onSave={handleSave}
              onDelete={setDeleteTarget}
              sortControls={
                tasks.length > 1
                  ? {
                      canMoveUp: index > 0,
                      canMoveDown: index < tasks.length - 1,
                      disabled: sorting,
                      onMoveUp: () => void moveTask(tasks, index, -1),
                      onMoveDown: () => void moveTask(tasks, index, 1),
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Разовые дела</p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.02] text-ink sm:text-5xl">
            Задачи
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            {active.length > 0
              ? `${tasksWord(active.length)} без отметки. Привычки остаются в своём разделе — здесь только то, что делается один раз.`
              : "Список дел, которые нужно сделать один раз. Привычки с повторением живут отдельно."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={17} /> Создать задачу
        </Button>
      </header>

      {active.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={26} />}
          title="Открытых задач нет"
          description="Нажмите «Создать задачу» — укажите название, описание и дату, если она важна. Задачи можно отмечать выполненными и возвращать в работу."
        />
      ) : (
        <div className="space-y-7">{groups.map((group) => renderGroup(group.key, group.title, group.hint, group.tasks))}</div>
      )}

      {completed.length > 0 ? (
        <section className="space-y-2.5">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="font-display text-xl leading-none text-ink">Выполненные</h2>
              <p className="mt-1 text-[11px] text-muted">Можно вернуть в работу</p>
            </div>
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
              {completed.length}
            </span>
          </div>
          <div className="space-y-2">
            {completed.slice(0, 20).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                pending={pendingId === task.id}
                onToggle={(item) => void handleToggle(item)}
                onSave={handleSave}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 rounded-[24px] border border-line/80 bg-surface/60 px-5 py-3 text-[11px] leading-relaxed text-muted">
        <ListTodo size={14} className="shrink-0 text-forest" />
        Задачи не влияют на статистику привычек и серии — это отдельный список разовых дел.
      </p>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Удалить задачу?"
        description={deleteTarget ? `Задача «${deleteTarget.title}» будет удалена.` : ""}
      />

      <TaskFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-24 rounded-[26px]" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
