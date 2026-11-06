export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysISO(value: string, days: number) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatLongDate(value: string) {
  return capitalize(
    new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(parseISODate(value)),
  );
}

export function formatShortDate(value: string, withYear = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  })
    .format(parseISODate(value))
    .replace(".", "");
}

export function formatFullDate(value: string) {
  return capitalize(
    new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parseISODate(value)),
  );
}

export function weekdayShort(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" })
    .format(parseISODate(value))
    .replace(".", "");
}

export function weekdayLabel(value: string) {
  return capitalize(
    new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(parseISODate(value)),
  );
}

export function dayNumber(value: string) {
  return parseISODate(value).getDate();
}

export function monthShort(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { month: "short" })
    .format(parseISODate(value))
    .replace(".", "");
}

export function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
}

export function daysWord(count: number) {
  return pluralRu(count, "день", "дня", "дней");
}

export function habitsWord(count: number) {
  return pluralRu(count, "привычка", "привычки", "привычек");
}

export function percent(value: number) {
  return `${Math.round(value)}%`;
}

export interface CategoryTone {
  dot: string;
  soft: string;
  text: string;
  bar: string;
  hex: string;
}

const tones: CategoryTone[] = [
  {
    dot: "bg-forest",
    soft: "bg-forest-soft",
    text: "text-forest",
    bar: "bg-forest",
    hex: "#1d5c48",
  },
  {
    dot: "bg-clay",
    soft: "bg-clay-soft",
    text: "text-clay-ink",
    bar: "bg-clay",
    hex: "#bf6a44",
  },
  {
    dot: "bg-gold",
    soft: "bg-gold-soft",
    text: "text-gold-ink",
    bar: "bg-gold",
    hex: "#c49a4a",
  },
  {
    dot: "bg-slate",
    soft: "bg-slate-soft",
    text: "text-slate-ink",
    bar: "bg-slate",
    hex: "#6c7f9e",
  },
  {
    dot: "bg-plum",
    soft: "bg-plum-soft",
    text: "text-plum-ink",
    bar: "bg-plum",
    hex: "#a06b8a",
  },
];

export function toneFor(categoryId: number): CategoryTone {
  return tones[Math.abs(categoryId) % tones.length];
}

export function toneForName(name: string): CategoryTone {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return tones[hash % tones.length];
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Что-то пошло не так. Попробуйте ещё раз";
}
