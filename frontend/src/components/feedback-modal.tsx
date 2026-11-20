"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { FeedbackKind } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) {
    return null;
  }

  return <FeedbackForm onClose={onClose} />;
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Напишите сообщение");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.sendFeedback({ kind, message: trimmedMessage });
      toast("Спасибо! Отзыв отправлен");
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
      title="Обратная связь"
      description="Идея, проблема или просто впечатление — всё это поможет сделать приложение лучше."
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="О чём хотите рассказать?" htmlFor="feedback-kind">
          <Select
            id="feedback-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as FeedbackKind)}
          >
            <option value="idea">Идея или пожелание</option>
            <option value="bug">Нашёл ошибку</option>
            <option value="other">Другое</option>
          </Select>
        </Field>

        <Field label="Сообщение" htmlFor="feedback-message" hint={`${message.length}/2000`}>
          <Textarea
            id="feedback-message"
            value={message}
            maxLength={2000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Расскажите подробнее…"
            autoFocus
            required
          />
        </Field>

        <p className="text-xs leading-relaxed text-muted">
          Отзыв будет привязан к вашему аккаунту, чтобы мы могли понять контекст.
        </p>

        {error ? (
          <p role="alert" className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !message.trim()}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            Отправить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
