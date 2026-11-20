"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { categoryColorOptions, categoryIconOptions } from "@/components/category-appearance";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import type { Category, CategoryIconName } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export function CategoryFormModal({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category?: Category | null;
}) {
  if (!open) {
    return null;
  }

  return <CategoryDialog onClose={onClose} category={category ?? null} />;
}

function CategoryDialog({
  onClose,
  category,
}: {
  onClose: () => void;
  category: Category | null;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<CategoryIconName>(category?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? categoryColorOptions[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Введите название категории");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (category) {
        await api.updateCategory(category.id, { name: name.trim(), icon, color });
        toast("Категория обновлена");
      } else {
        await api.createCategory({ name: name.trim(), icon, color });
        toast("Категория создана");
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
      title={category ? "Редактировать категорию" : "Новая категория"}
      description="Категории помогают собрать привычки по смыслу: здоровье, работа, обучение."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Название" htmlFor="category-name" hint={`${name.length}/80`}>
          <Input
            id="category-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Здоровье"
            autoFocus
          />
        </Field>

        <Field label="Значок">
          <div role="group" aria-label="Значок категории" className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {categoryIconOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={icon === value}
                onClick={() => setIcon(value)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:border-forest/30 hover:bg-ink/5"
                style={
                  icon === value
                    ? { color, borderColor: color, backgroundColor: `${color}18` }
                    : undefined
                }
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Цвет" htmlFor="category-color">
          <div className="flex flex-wrap items-center gap-2">
            {categoryColorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.name}
                aria-pressed={color.toLowerCase() === option.value}
                title={option.name}
                onClick={() => setColor(option.value)}
                className="grid h-8 w-8 place-items-center rounded-full border border-line/70 transition hover:scale-105"
                style={{ backgroundColor: option.value }}
              >
                {color.toLowerCase() === option.value ? (
                  <span className="h-2 w-2 rounded-full bg-white shadow" />
                ) : null}
              </button>
            ))}
            <input
              id="category-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Выбрать свой цвет"
              className="h-9 w-11 cursor-pointer rounded-xl border border-line bg-surface p-1"
            />
          </div>
        </Field>

        {error ? (
          <p className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {category ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
