"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  BarChart3,
  Leaf,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Sparkles,
  SunMedium,
  Tags,
  X,
} from "lucide-react";

import type { Category } from "@/lib/types";
import { cn, normalizePathname, toneFor } from "@/lib/utils";

import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Сегодня", icon: SunMedium, exact: true },
  { href: "/habits", label: "Привычки", icon: ListChecks, exact: false },
  { href: "/categories", label: "Категории", icon: Tags, exact: false },
  { href: "/stats", label: "Статистика", icon: BarChart3, exact: false },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = normalizePathname(usePathname());
  const { user, logout } = useAuth();
  const { data: categories, error } = useSWR<Category[]>("/api/categories");

  const initials = (user?.name || user?.email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-2">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-forest-solid text-ivory shadow-[0_10px_24px_-14px_rgba(29,92,72,0.9)]">
          <Leaf size={22} strokeWidth={1.8} />
        </span>
        <span>
          <span className="block font-display text-[22px] leading-none text-ink">привычка</span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            маленькие шаги
          </span>
        </span>
      </Link>

      <nav className="mt-10 space-y-1" aria-label="Основная навигация">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                active
                  ? "bg-forest-solid text-ivory shadow-[0_12px_24px_-16px_rgba(29,92,72,1)]"
                  : "text-muted hover:bg-ink/5 hover:text-ink",
              )}
            >
              <item.icon size={18} strokeWidth={active ? 2.1 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 space-y-2 px-1">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 rounded-2xl border border-line/70 bg-surface/45 px-2.5 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest-solid text-[11px] font-bold text-ivory">
            {initials || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-ink">
              {user?.name || "Профиль"}
            </p>
            <p className="truncate text-[10px] text-muted">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              void logout();
            }}
            aria-label="Выйти из аккаунта"
            title="Выйти"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div className="mt-9 min-h-0 flex-1">
        <div className="flex items-center justify-between px-3">
          <p className="eyebrow">Категории</p>
          <Link
            href="/categories"
            onClick={onNavigate}
            aria-label="Управлять категориями"
            className="grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <Plus size={14} />
          </Link>
        </div>

        <div className="mt-3 space-y-0.5">
          {!categories && !error
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-line" />
                  <span className="h-2.5 w-24 animate-pulse rounded-full bg-line/80" />
                </div>
              ))
            : null}

          {categories?.map((category) => {
            const tone = toneFor(category.id);
            return (
              <Link
                key={category.id}
                href={`/habits?category=${category.id}`}
                onClick={onNavigate}
                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[13px] text-muted transition hover:bg-ink/5 hover:text-ink"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
                  <span className="truncate">{category.name}</span>
                </span>
                <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {category.habitCount}
                </span>
              </Link>
            );
          })}

          {categories?.length === 0 ? (
            <p className="px-3 py-2 text-[13px] leading-relaxed text-muted">
              Пока пусто.{" "}
              <Link href="/categories" onClick={onNavigate} className="text-forest underline-offset-2 hover:underline">
                Добавьте первую категорию
              </Link>
              .
            </p>
          ) : null}

          {error ? (
            <p className="px-3 py-2 text-[12px] leading-relaxed text-clay">
              Не удалось загрузить категории
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-[26px] bg-gradient-to-br from-forest-solid to-forest-deep p-5 text-ivory">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full border border-ivory/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-24 w-24 rounded-full bg-ivory/5" />
        <Sparkles size={17} className="relative text-gold" />
        <p className="relative mt-4 font-display text-[19px] leading-[1.35]">
          Маленькие шаги складываются в большие перемены.
        </p>
        <p className="relative mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory/50">
          Ритм важнее рывка
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = normalizePathname(usePathname());
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";
  // /debug must stay reachable without a session: it shows login/API failures.
  const isPublicPage = isLoginPage || pathname === "/debug";

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user && !isPublicPage) {
      router.replace("/login");
    } else if (user && isLoginPage) {
      router.replace("/");
    }
  }, [loading, user, isLoginPage, isPublicPage, router]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return <AuthSplash />;
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r border-line/70 bg-sidebar/85 px-5 py-7 backdrop-blur-xl lg:flex">
        <SidebarContent />
      </aside>

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/70 bg-paper/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-solid text-ivory">
              <Leaf size={18} strokeWidth={1.8} />
            </span>
            <span className="font-display text-xl leading-none text-ink">привычка</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Открыть меню"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink"
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10">
          {children}
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-forest-deep/35 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[300px] max-w-[88vw] overflow-y-auto border-r border-line bg-sidebar px-5 py-7 shadow-lift animate-scale-in">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Закрыть меню"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted"
            >
              <X size={16} />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuthSplash() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-forest-solid text-ivory shadow-card">
          <Leaf size={26} strokeWidth={1.8} />
        </span>
        <p className="font-display text-xl text-ink">привычка</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Загружаем ваш ритм
        </p>
      </div>
    </div>
  );
}
