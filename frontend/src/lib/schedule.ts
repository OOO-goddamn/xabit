import type { Habit, RepeatType } from "@/lib/types";

export const WEEKDAY_OPTIONS: Array<{ value: number; short: string; label: string }> = [
  { value: 1, short: "Пн", label: "Понедельник" },
  { value: 2, short: "Вт", label: "Вторник" },
  { value: 3, short: "Ср", label: "Среда" },
  { value: 4, short: "Чт", label: "Четверг" },
  { value: 5, short: "Пт", label: "Пятница" },
  { value: 6, short: "Сб", label: "Суббота" },
  { value: 7, short: "Вс", label: "Воскресенье" },
];

export const REPEAT_OPTIONS: Array<{
  value: RepeatType;
  label: string;
  hint: string;
}> = [
  { value: "daily", label: "Каждый день", hint: "Без выходных" },
  { value: "weekly", label: "По дням недели", hint: "Например, Пн и Ср" },
  { value: "monthly", label: "Раз в месяц", hint: "Например, 15-е число" },
];

export function monthDayLabel(day: number) {
  return `${day}-е число`;
}

export function scheduleLabel(
  habit: Pick<Habit, "repeat" | "weekdays" | "monthDay">,
): string {
  switch (habit.repeat) {
    case "weekly": {
      const days = [...(habit.weekdays ?? [])].sort((a, b) => a - b);
      if (days.length === 0) {
        return "По дням недели";
      }
      return days
        .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.short)
        .filter(Boolean)
        .join(", ");
    }
    case "monthly":
      return habit.monthDay ? `Каждое ${monthDayLabel(habit.monthDay)}` : "Раз в месяц";
    default:
      return "Каждый день";
  }
}
