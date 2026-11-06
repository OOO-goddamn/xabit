"use client";

import { useState } from "react";
import { ArrowRight, Leaf, Loader2, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { errorMessage } from "@/lib/utils";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo() {
    setMode("login");
    setEmail("demo@habit.local");
    setPassword("habit12345");
    setError(null);
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-forest/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />

      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-forest-solid text-ivory shadow-[0_10px_24px_-14px_rgba(29,92,72,0.9)]">
            <Leaf size={20} strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-display text-xl leading-none text-ink">привычка</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
              маленькие шаги
            </p>
          </div>
        </div>
        <ThemeToggle compact />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-12 pt-2 sm:px-6">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-[32px] border border-line bg-surface shadow-lift lg:grid-cols-[1.02fr_1fr]">
          <aside className="relative hidden overflow-hidden bg-gradient-to-br from-forest-solid to-forest-deep p-10 text-ivory lg:flex lg:flex-col lg:justify-between">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-ivory/10" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-ivory/5" />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-ivory/15 bg-ivory/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ivory/75">
                <Sparkles size={12} className="text-gold" />
                личный трекер
              </span>
              <h2 className="mt-7 font-display text-[34px] leading-[1.15]">
                Маленькие шаги складываются в большие перемены.
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory/65">
                Отмечайте то, что получилось. Замечайте ритм. Возвращайтесь к себе —
                без давления и идеальных дней.
              </p>
            </div>

            <ul className="relative mt-10 space-y-3 text-[12px] text-ivory/80">
              <li className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ivory/10">1</span>
                Свои категории и привычки
              </li>
              <li className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ivory/10">2</span>
                Серии, неделя и статистика
              </li>
              <li className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ivory/10">3</span>
                Заметки о каждом дне
              </li>
            </ul>
          </aside>

          <section className="p-6 sm:p-9">
            <p className="eyebrow">Аккаунт</p>
            <h1 className="mt-2 font-display text-[32px] leading-tight text-ink">
              {mode === "login" ? "С возвращением" : "Начните свой ритм"}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {mode === "login"
                ? "Войдите, чтобы вернуться к своим привычкам и истории."
                : "Создайте аккаунт — данные будут привязаны только к вам."}
            </p>

            <div className="mt-6 flex rounded-2xl border border-line/70 bg-cream p-1">
              {(
                [
                  ["login", "Вход"],
                  ["register", "Регистрация"],
                ] as Array<[Mode, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  aria-pressed={mode === value}
                  className={
                    mode === value
                      ? "h-9 flex-1 rounded-xl bg-forest-solid text-[12px] font-semibold text-ivory shadow-sm transition"
                      : "h-9 flex-1 rounded-xl text-[12px] font-semibold text-muted transition hover:text-ink"
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === "register" ? (
                <Field label="Имя" htmlFor="auth-name" hint="необязательно">
                  <Input
                    id="auth-name"
                    value={name}
                    maxLength={80}
                    autoComplete="name"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Как к вам обращаться?"
                  />
                </Field>
              ) : null}

              <Field label="Email" htmlFor="auth-email">
                <Input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>

              <Field
                label="Пароль"
                htmlFor="auth-password"
                hint={mode === "register" ? "минимум 8 символов" : undefined}
              >
                <Input
                  id="auth-password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              {error ? (
                <p className="rounded-2xl bg-clay-soft/70 px-4 py-3 text-sm text-clay-ink">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                {mode === "login" ? "Войти" : "Создать аккаунт"}
              </Button>
            </form>

            <div className="mt-5 rounded-2xl border border-dashed border-line bg-cream/60 px-4 py-3 text-[12px] leading-relaxed text-muted">
              <p>
                Для демо-данных:{" "}
                <span className="font-semibold text-ink">demo@habit.local</span> /{" "}
                <span className="font-semibold text-ink">habit12345</span>
              </p>
              <button
                type="button"
                onClick={fillDemo}
                className="mt-1.5 text-[12px] font-semibold text-forest underline-offset-4 hover:underline"
              >
                Подставить демо-доступ
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
