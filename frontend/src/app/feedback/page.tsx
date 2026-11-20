"use client";

import useSWR from "swr";
import { AlertTriangle, Lightbulb, MessageSquareText, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/empty-state";
import { ApiError } from "@/lib/api";
import type { FeedbackItem, FeedbackKind } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const kindLabels: Record<FeedbackKind, string> = {
  idea: "Идея",
  bug: "Ошибка",
  other: "Другое",
};

export default function FeedbackPage() {
  const { data, error, mutate, isValidating } = useSWR<FeedbackItem[]>("/api/feedback");

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20">
        <EmptyState
          icon={error instanceof ApiError && error.status === 403 ? <ShieldAlert size={24} /> : <AlertTriangle size={24} />}
          title={error instanceof ApiError && error.status === 403 ? "Нет доступа к отзывам" : "Не удалось загрузить отзывы"}
          description={error instanceof ApiError && error.status === 403 ? "Этот раздел доступен только администратору приложения." : errorMessage(error)}
          action={error instanceof ApiError && error.status === 403 ? undefined : <Button onClick={() => void mutate()}>Попробовать снова</Button>}
        />
      </div>
    );
  }

  if (!data) {
    return <FeedbackSkeleton />;
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Сообщения пользователей</p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.02] text-ink sm:text-5xl">
            Обратная связь
          </h1>
          <p className="mt-2 text-sm text-muted">
            Последние {data.length === 100 ? "100" : data.length} сообщений
          </p>
        </div>
        <Button variant="secondary" onClick={() => void mutate()} disabled={isValidating}>
          <RefreshCw size={15} className={isValidating ? "animate-spin" : undefined} />
          Обновить
        </Button>
      </header>

      {data.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText size={25} />}
          title="Пока отзывов нет"
          description="Когда пользователь отправит идею или сообщит об ошибке, сообщение появится здесь."
        />
      ) : (
        <section aria-label="Список отзывов" className="space-y-3">
          {data.map((item) => (
            <article
              key={item.id}
              className="rounded-[26px] border border-line bg-surface p-5 shadow-card sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-soft text-forest">
                    {item.kind === "idea" ? <Lightbulb size={17} /> : <AlertTriangle size={17} />}
                  </span>
                  <span className="rounded-full bg-cream px-3 py-1 text-[11px] font-semibold text-muted">
                    {kindLabels[item.kind]}
                  </span>
                </div>
                <time
                  dateTime={item.createdAt}
                  className="text-[11px] font-medium text-muted"
                >
                  {formatFeedbackDate(item.createdAt)}
                </time>
              </div>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                {item.message}
              </p>
              <a
                href={`mailto:${encodeURIComponent(item.userEmail)}`}
                className="mt-4 inline-block text-xs font-semibold text-forest underline-offset-4 hover:underline"
              >
                {item.userEmail}
              </a>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function formatFeedbackDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function FeedbackSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-40 rounded-[26px]" />
      ))}
    </div>
  );
}
