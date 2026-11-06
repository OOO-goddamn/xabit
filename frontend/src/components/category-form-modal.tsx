"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
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
        await api.updateCategory(category.id, name.trim());
        toast("Категория обновлена");
      } else {
        await api.createCategory(name.trim());
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
      size="sm"
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
