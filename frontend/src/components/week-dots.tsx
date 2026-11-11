import { Check, Minus } from "lucide-react";

import type { DayStatus } from "@/lib/types";
import { cn, formatShortDate, weekdayLabel, weekdayShort } from "@/lib/utils";

export function WeekDots({
  week,
  today,
  compact = false,
}: {
  week: DayStatus[];
  today?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-end gap-1 sm:gap-1.5" role="group" aria-label="Неделя">
      {week.map((day) => {
        const isToday = today === day.date;
        const isFuture = today ? day.date > today : false;
        const offDay = day.due === false && !day.status;
        const covered = offDay && day.covered === true;
        const label = day.status
          ? day.status === "done"
            ? "выполнено"
            : "пропущено"
          : covered
            ? "не по расписанию, ритм сохранён"
            : offDay
              ? "не по расписанию"
              : "нет отметки";
        const accessibleLabel = `${weekdayLabel(day.date)}, ${formatShortDate(day.date)}${isToday ? " (сегодня)" : ""} — ${label}`;

        return (
          <div key={day.date} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "text-[9px] font-semibold uppercase tracking-wide",
                isToday ? "text-forest" : "text-muted/60",
              )}
            >
              {weekdayShort(day.date)}
            </span>
            <span
              role="img"
              aria-label={accessibleLabel}
              title={`${weekdayLabel(day.date)}, ${formatShortDate(day.date)} — ${label}`}
              className={cn(
                "grid place-items-center rounded-full border transition-colors",
                compact ? "h-5 w-5" : "h-5 w-5 sm:h-6 sm:w-6",
                day.status === "done" && "border-forest-solid bg-forest-solid text-ivory",
                day.status === "skipped" && "border-clay/20 bg-clay-soft text-clay",
                covered && "border-dashed border-forest/30 bg-forest/5 text-forest/45",
                offDay && !covered && "border-dashed border-line/70 bg-cream/30 text-muted/40",
                !day.status && !offDay && "border-line bg-cream/60",
                isFuture && !day.status && "border-dashed opacity-55",
                isToday && "ring-2 ring-forest/20 ring-offset-1 ring-offset-surface",
              )}
            >
              {day.status === "done" ? (
                <Check size={compact ? 10 : 12} strokeWidth={3.2} />
              ) : day.status === "skipped" ? (
                <Minus size={compact ? 10 : 12} strokeWidth={3} />
              ) : covered ? (
                <Check
                  size={compact ? 10 : 12}
                  strokeWidth={3}
                  className="opacity-30"
                />
              ) : offDay ? (
                <Minus
                  size={compact ? 8 : 10}
                  strokeWidth={3}
                  className="opacity-40"
                />
              ) : (
                <span className="h-1 w-1 rounded-full bg-line" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
