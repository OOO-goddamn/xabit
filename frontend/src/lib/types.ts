export type CompletionStatus = "done" | "skipped" | "progress";

export type RepeatType = "daily" | "weekly" | "monthly";

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Category {
  id: number;
  name: string;
  habitCount: number;
}

export interface Habit {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  categoryName: string;
  reminderTime: string;
  targetValue: number | null;
  unit: string;
  stepValue: number;
  repeat: RepeatType;
  weekdays: number[];
  monthDay: number | null;
  createdAt: string;
}

export interface Completion {
  id: number;
  habitId: number;
  date: string;
  status: CompletionStatus;
  value: number;
  note: string;
}

export interface DayStatus {
  date: string;
  status: CompletionStatus | null;
  due?: boolean;
  covered?: boolean;
  value?: number;
}

export interface DashboardHabit extends Habit {
  completion: Completion | null;
  week: DayStatus[];
  streak: number;
  done30: number;
  due?: boolean;
  covered?: boolean;
}

export interface DashboardStats {
  total: number;
  done: number;
  skipped: number;
  remaining: number;
  bestStreak: number;
  rate30: number;
}

export interface DashboardResponse {
  date: string;
  weekStart: string;
  weekEnd: string;
  stats: DashboardStats;
  habits: DashboardHabit[];
}

export interface StatsTotals {
  done: number;
  skipped: number;
  possible: number;
  rate: number;
}

export interface StatsDay {
  date: string;
  done: number;
  skipped: number;
  possible: number;
  rate: number;
}

export interface StatsHabit {
  id: number;
  name: string;
  categoryName: string;
  targetValue: number | null;
  unit: string;
  stepValue: number;
  done: number;
  skipped: number;
  rate: number;
  streak: number;
  history: DayStatus[];
}

export interface StatsResponse {
  from: string;
  to: string;
  days: number;
  totals: StatsTotals;
  daily: StatsDay[];
  habits: StatsHabit[];
}

export interface HabitInput {
  name: string;
  description: string;
  categoryId: number;
  reminderTime: string;
  targetValue: number | null;
  unit: string;
  stepValue: number;
  repeat: RepeatType;
  weekdays: number[];
  monthDay: number | null;
}

export interface PushConfig {
  enabled: boolean;
  publicKey: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  timezone: string;
}

export interface CompletionInput {
  habitId: number;
  date: string;
  status: CompletionStatus;
  value?: number;
  note: string;
}
