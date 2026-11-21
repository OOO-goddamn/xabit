"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, FolderPlus, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRevalidateApi } from "@/hooks/use-revalidate-api";
import { api } from "@/lib/api";
import {
  MAX_DRAFT_INPUT_LENGTH,
  MAX_DRAFT_ITEMS,
  MAX_DRAFT_NAME_LENGTH,
  parseHabitDrafts,
} from "@/lib/parse-habits";
import type { Category, HabitInput } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

interface Draft {
  key: number;
  name: string;
  categoryId: number;
  error?: string;
}

function habitPayload(name: string, categoryId: number): HabitInput {
  return {
    name,
    description: "",
    categoryId,
    reminderTime: "",
    targetValue: null,
    unit: "",
    stepValue: 1,
    repeat: "daily",
    weekdays: [],
    monthDay: null,
  };
}

export function BulkHabitsModal({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}) {
  if (!open) {
    return null;
  }

  return <BulkHabitsDialog onClose={onClose} categories={categories} />;
}

function BulkHabitsDialog({
  onClose,
  categories,
}: {
  onClose: () => void;
  categories: Category[];
}) {
  const defaultCategoryId = categories[0]?.id ?? 0;
  const [raw, setRaw] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [step, setStep] = useState<"input" | "review">("input");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(1);

  const { toast } = useToast();
  const revalidate = useRevalidateApi();

  function makeDraft(name: string, categoryId = defaultCategoryId): Draft {
    nextKey.current += 1;
    return { key: nextKey.current, name, categoryId };
  }

  function handleParse() {
    const parsed = parseHabitDrafts(raw);
    if (parsed.length === 0) {
      setError("Не нашлось ни одного пункта. Напишите по одному делу на строку.");
      return;
    }

    setError(null);
    setDrafts(parsed.map((name) => makeDraft(name)));
    setStep("review");
  }

  function updateDraft(key: number, patch: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch, error: undefined } : draft)),
    );
  }

  function removeDraft(key: number) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  async function handleCreate() {
    const prepared = drafts
      .map((draft) => ({ ...draft, name: draft.name.trim() }))
      .filter((draft) => draft.name !== "");

    if (prepared.length === 0) {
      setError("Добавьте хотя бы одну привычку");
      return;
    }
    if (prepared.some((draft) => !draft.categoryId)) {
      setError("Выберите категорию для каждой привычки");
      return;
    }

    setSaving(true);
    setError(null);

    const failed: Draft[] = [];
    let created = 0;

    for (const draft of prepared) {
      try {
        await api.createHabit(habitPayload(draft.name, draft.categoryId));
        created += 1;
      } catch (requestError) {
        failed.push({ ...draft, error: errorMessage(requestError) });
      }
    }

    if (created > 0) {
      await revalidate().catch(() => undefined);
    }

    setSaving(false);

    if (failed.length === 0) {
      toast(created === 1 ? "Привычка создана" : `Создано привычек: ${created}`);
      onClose();
      return;
    }

    setDrafts(failed);
    setError(
      created > 0
        ? `Создано ${created}, не удалось ${failed.length}. Исправьте отмеченные пункты.`
        : "Не удалось создать привычки. Проверьте список и попробуйте снова.",
    );
  }

  const heading = step === "input" ? "Разобрать список" : "Проверьте привычки";

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) {
          onClose();
        }
      }}
      title={heading}
      description={
        step === "input"
          ? "Вставьте список дел — приложение разложит его на черновики привычек. Ничего не сохранится, пока вы не подтвердите."
          : "Поправьте названия и категории, уберите лишнее. Сохранятся только отмеченные вами пункты."
      }
      size="lg"
    >
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-cream/60 p-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-forest-soft text-forest">
            <FolderPlus size={20} />
          </span>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Сначала создайте категорию — привычкам нужно место в вашей системе.
          </p>
          <Link
            href="/categories"
            onClick={onClose}
            className="mt-4 inline-flex text-sm font-semibold text-forest underline-offset-4 hover:underline"
          >
            Перейти к категориям
          </Link>
        </div>
      ) : step === "input" ? (
        <div className="space-y-5">
          <Field
            label="Ваш список"
            htmlFor="bulk-habits-text"
            hint={`${raw.length}/${MAX_DRAFT_INPUT_LENGTH}`}
          >
            <Textarea
              id="bulk-habits-text"
              value={raw}
              maxLength={MAX_DRAFT_INPUT_LENGTH}
              onChange={(event) => setRaw(event.target.value)}
              placeholder={"Например:\n- пить воду утром\n- 20 минут растяжки\n- читать перед сном"}
              rows={8}
              autoFocus
            />
          </Field>

          <p className="text-[11px] leading-relaxed text-muted">
            По одному пункту на строку (или через точку с запятой). Маркеры «-», «•» и нумерация
            убираются автоматически. Строки с двоеточием на конце считаются заголовками и
            пропускаются. До {MAX_DRAFT_ITEMS} пунктов.
          </p>

          {error ? (
            <p role="alert" className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="button" onClick={handleParse} disabled={!raw.trim()}>
              <ClipboardList size={16} />
              Разобрать
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {drafts.map((draft, index) => (
              <div key={draft.key} className="rounded-2xl border border-line bg-cream/40 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2.5 w-5 shrink-0 text-center text-[11px] font-semibold text-muted">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={draft.name}
                      maxLength={MAX_DRAFT_NAME_LENGTH}
                      aria-label={`Название привычки ${index + 1}`}
                      onChange={(event) => updateDraft(draft.key, { name: event.target.value })}
                    />
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Select
                          value={draft.categoryId}
                          aria-label={`Категория привычки ${index + 1}`}
                          className="h-9"
                          onChange={(event) =>
                            updateDraft(draft.key, { categoryId: Number(event.target.value) })
                          }
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDraft(draft.key)}
                        aria-label={`Убрать привычку ${index + 1}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-clay-soft hover:text-clay"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {draft.error ? (
                      <p className="text-[11px] leading-relaxed text-clay-ink">{draft.error}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDrafts((current) => [...current, makeDraft("")])}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-forest transition hover:gap-2.5"
          >
            <Plus size={14} />
            Добавить пункт
          </button>

          {error ? (
            <p role="alert" className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setError(null);
                setStep("input");
              }}
              disabled={saving}
            >
              <ArrowLeft size={15} />
              Назад
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={saving || drafts.length === 0}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? "Сохраняем…" : `Создать ${drafts.length || ""}`.trim()}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
