"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowRight,
  FolderOpen,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";

import { CategoryFormModal } from "@/components/category-form-modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, Skeleton } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import { cn, errorMessage, habitsWord, pluralRu, toneFor } from "@/lib/utils";

export default function CategoriesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const revalidate = useRevalidateApi();
  const { data: categories, error, mutate } = useSWR<Category[]>("/api/categories");

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    try {
      await api.deleteCategory(deleteTarget.id);
      await revalidate();
      toast("Категория удалена");
      setDeleteTarget(null);
    } catch (requestError) {
      toast(errorMessage(requestError), "error");
    } finally {
      setDeleting(false);
    }
  }

  const totalHabits = categories?.reduce((sum, category) => sum + category.habitCount, 0) ?? 0;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Структура</p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.02] text-ink sm:text-5xl">
            Категории
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            {categories && categories.length > 0
              ? `${categories.length} ${pluralRu(categories.length, "категория", "категории", "категорий")} и ${totalHabits} ${habitsWord(totalHabits)} в вашей системе.`
              : "Соберите привычки по смыслу — так проще видеть баланс между сферами жизни."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={17} /> Новая категория
        </Button>
      </header>

      {error ? (
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="Не удалось загрузить категории"
          description={errorMessage(error)}
          action={<Button onClick={() => mutate()}>Попробовать снова</Button>}
        />
      ) : !categories ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[210px] rounded-[26px]" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={26} />}
          title="Пока нет ни одной категории"
          description="Например: «Здоровье», «Работа», «Обучение» или «Отдых». Одна категория — уже хорошее начало."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} /> Создать категорию
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category, index) => {
            const tone = toneFor(category.id);

            return (
              <article
                key={category.id}
                className="group relative flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface p-5 pt-6 shadow-[0_1px_0_rgba(23,51,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card animate-fade-up"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <span className={cn("absolute inset-x-0 top-0 h-1.5", tone.bar)} />

                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-2xl",
                      tone.soft,
                      tone.text,
                    )}
                  >
                    <Tag size={19} />
                  </span>

                  <div className="flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      aria-label={`Переименовать категорию «${category.name}»`}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={category.habitCount > 0}
                      onClick={() => setDeleteTarget(category)}
                      aria-label={`Удалить категорию «${category.name}»`}
                      title={
                        category.habitCount > 0
                          ? "Сначала перенесите или удалите привычки из категории"
                          : "Удалить категорию"
                      }
                      className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-clay-soft hover:text-clay disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h2 className="mt-4 font-display text-[26px] leading-tight text-ink">
                  {category.name}
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  {category.habitCount} {habitsWord(category.habitCount)}
                </p>

                <Link
                  href={`/habits?category=${category.id}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-forest transition hover:gap-2.5"
                >
                  Посмотреть привычки
                  <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}

          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-line bg-surface/40 p-5 text-muted transition hover:border-forest/35 hover:bg-surface hover:text-forest"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full border border-line bg-cream">
              <Plus size={19} />
            </span>
            <span className="text-[13px] font-semibold">Добавить категорию</span>
          </button>
        </div>
      )}

      <CategoryFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        category={editing}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Удалить категорию?"
        description={
          deleteTarget
            ? `Категория «${deleteTarget.name}» будет удалена. Это действие нельзя отменить.`
            : ""
        }
      />
    </div>
  );
}
