"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    logger.error("Ошибка рендера", {
      error: error instanceof Error ? error : undefined,
      reason: error instanceof Error ? undefined : String(error),
    });
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="flex max-w-[440px] flex-col items-center gap-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-clay/10 text-clay">
          <AlertCircle size={24} />
        </span>
        <h1 className="font-display text-xl text-ink">Что-то пошло не так</h1>
        <p className="text-sm leading-relaxed text-muted">
          Ошибка записана в диагностику. Попробуйте обновить страницу — если не поможет,
          откройте <span className="font-semibold text-ink">/debug</span> и пришлите логи.
        </p>
        <Button variant="secondary" type="button" onClick={() => retry()}>
          Попробовать снова
        </Button>
      </div>
    </div>
  );
}
