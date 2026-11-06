"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Удалить",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm} disabled={loading}>
            {loading ? "Удаляем…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4 rounded-2xl bg-clay-soft/60 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay/10 text-clay">
          <AlertTriangle size={19} />
        </span>
        <p className="text-sm leading-relaxed text-clay-ink">{description}</p>
      </div>
    </Modal>
  );
}
