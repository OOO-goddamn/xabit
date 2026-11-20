import {
  Activity,
  Apple,
  BookOpen,
  Brain,
  Briefcase,
  Coffee,
  Dumbbell,
  GraduationCap,
  Heart,
  House,
  Leaf,
  Sparkles,
  Sun,
  Tag,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

import type { CategoryIconName } from "@/lib/types";

export const categoryIconOptions: Array<{
  value: CategoryIconName;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "tag", label: "Метка", Icon: Tag },
  { value: "heart", label: "Здоровье", Icon: Heart },
  { value: "activity", label: "Активность", Icon: Activity },
  { value: "book", label: "Чтение", Icon: BookOpen },
  { value: "briefcase", label: "Работа", Icon: Briefcase },
  { value: "dumbbell", label: "Спорт", Icon: Dumbbell },
  { value: "apple", label: "Питание", Icon: Apple },
  { value: "brain", label: "Развитие", Icon: Brain },
  { value: "home", label: "Дом", Icon: House },
  { value: "wallet", label: "Финансы", Icon: Wallet },
  { value: "sparkles", label: "Уход", Icon: Sparkles },
  { value: "sun", label: "Энергия", Icon: Sun },
  { value: "leaf", label: "Природа", Icon: Leaf },
  { value: "education", label: "Учёба", Icon: GraduationCap },
  { value: "target", label: "Цели", Icon: Target },
  { value: "coffee", label: "Отдых", Icon: Coffee },
];

const iconByName = Object.fromEntries(
  categoryIconOptions.map(({ value, Icon }) => [value, Icon]),
) as Record<CategoryIconName, LucideIcon>;

export const categoryColorOptions = [
  { name: "Лесной", value: "#1d5c48" },
  { name: "Терракотовый", value: "#bf6a44" },
  { name: "Золотой", value: "#c49a4a" },
  { name: "Сланцевый", value: "#6c7f9e" },
  { name: "Сливовый", value: "#a06b8a" },
  { name: "Синий", value: "#3975b7" },
  { name: "Бирюзовый", value: "#25877d" },
  { name: "Розовый", value: "#ba5e79" },
  { name: "Оранжевый", value: "#c66b2e" },
  { name: "Индиго", value: "#665caa" },
  { name: "Красный", value: "#b84949" },
  { name: "Оливковый", value: "#6c8f35" },
] as const;

export function CategoryIcon({
  name,
  size = 18,
  className,
  style,
}: {
  name: CategoryIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = iconByName[name] ?? Tag;
  return <Icon size={size} className={className} style={style} aria-hidden="true" />;
}

export function categoryContrastText(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return "#ffffff";
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? "#17332a" : "#ffffff";
}
