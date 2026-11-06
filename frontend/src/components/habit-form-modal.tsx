"use client";

import { useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import type { Category, Habit } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

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

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        categoryId: activeCategoryId,
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
          ? "Измените название, описание или категорию."
          : "Небольшое действие, которое хочется повторять каждый день."
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
