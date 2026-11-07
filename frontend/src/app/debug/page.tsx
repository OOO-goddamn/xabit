"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Download, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clearLogs,
  getDebugServerSnapshot,
  getLogsServerSnapshot,
  getLogsSnapshot,
  isDebugEnabled,
  reloadLogs,
  setDebugEnabled,
  subscribeDebug,
  subscribeLogs,
  type LogLevel,
} from "@/lib/logger";

const levelStyles: Record<LogLevel, string> = {
  debug: "bg-ink/5 text-muted",
  info: "bg-forest-soft text-forest",
  warn: "bg-gold-soft text-gold-ink",
  error: "bg-clay/10 text-clay",
};

const levelLabels: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}

export default function DebugPage() {
  const logs = useSyncExternalStore(subscribeLogs, getLogsSnapshot, getLogsServerSnapshot);
  const verbose = useSyncExternalStore(subscribeDebug, isDebugEnabled, getDebugServerSnapshot);
  const [message, setMessage] = useState<string | null>(null);

  const entries = useMemo(() => logs.slice().reverse(), [logs]);
  const payload = useMemo(() => JSON.stringify(entries, null, 2), [entries]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setMessage("Логи скопированы в буфер обмена");
    } catch {
      setMessage("Не удалось скопировать: браузер запретил доступ к буферу");
    }
  }

  function download() {
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `habit-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Файл с логами скачан");
  }

  function toggleVerbose() {
    const next = !verbose;
    setDebugEnabled(next);
    setMessage(next ? "Подробные логи включены" : "Подробные логи выключены");
  }

  function clear() {
    clearLogs();
    setMessage("Логи очищены");
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={15} />
              На главную
            </Link>
            <h1 className="font-display text-2xl text-ink">Диагностика</h1>
            <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-muted">
              Логи хранятся только в этом браузере (localStorage) и никуда не отправляются.
              Записываются ошибки JS и неудачные запросы к API. Показаны последние записи, всего до 200.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={reloadLogs}>
              <RefreshCw size={15} />
              Обновить
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={copy}>
              <Copy size={15} />
              Копировать
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={download}>
              <Download size={15} />
              Скачать JSON
            </Button>
            <Button size="sm" variant="danger" type="button" onClick={clear}>
              <Trash2 size={15} />
              Очистить
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Подробные логи</p>
            <p className="text-[12px] text-muted">
              Дополнительно записывает успешные API-запросы и старт приложения.
            </p>
          </div>
          <Button
            size="sm"
            variant={verbose ? "subtle" : "secondary"}
            type="button"
            onClick={toggleVerbose}
          >
            {verbose ? "Выключить" : "Включить"}
          </Button>
        </div>

        {message ? (
          <p className="rounded-xl border border-forest/20 bg-forest-soft px-4 py-2 text-[13px] text-forest">
            {message}
          </p>
        ) : null}

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
            Записей пока нет. Воспроизведите проблему и нажмите «Обновить».
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] ${levelStyles[entry.level]}`}
                  >
                    {levelLabels[entry.level]}
                  </span>
                  <span className="text-sm font-semibold text-ink">{entry.message}</span>
                  <span className="ml-auto text-[11px] text-muted">{formatTime(entry.ts)}</span>
                </div>
                {entry.data ? (
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-ink/5 px-3 py-2 text-[11px] leading-relaxed text-muted">
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
