# Привычка

Спокойный трекер привычек без пользователей и авторизации: категории, ежедневные отметки, заметки, серии и статистика.

**Стек**

- Бэкенд: Go 1.25, стандартный `net/http`, PostgreSQL 17, `pgx/v5`
- Фронтенд: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SWR, lucide-react
- База: PostgreSQL, миграции встроены в Go-бинарник и применяются при старте

## Быстрый старт

### 1. PostgreSQL

Самый простой вариант — Docker:

```powershell
docker compose up -d db
```

Если Docker не установлен, создайте локальную базу вручную:

```sql
CREATE USER habit WITH PASSWORD 'habit';
CREATE DATABASE habit OWNER habit;
```

Параметры подключения по умолчанию:

```
postgres://habit:habit@localhost:5432/habit?sslmode=disable
```

### 2. Бэкенд

```powershell
cd backend
go run ./cmd/api
```

API поднимется на `http://localhost:8080`. Миграции применяются автоматически при запуске.

Чтобы наполнить базу демо-данными (4 категории, 9 привычек и история отметок за 20 дней):

```powershell
go run ./cmd/seed
```

Пересоздать демо-данные с нуля:

```powershell
go run ./cmd/seed -force
```

Настройки читаются из переменных окружения или из `backend/.env` (пример — `backend/.env.example`):

| Переменная     | По умолчанию                                                      |
| -------------- | ----------------------------------------------------------------- |
| `PORT`         | `8080`                                                            |
| `DATABASE_URL` | `postgres://habit:habit@localhost:5432/habit?sslmode=disable`     |
| `CORS_ORIGINS` | `http://localhost:3000`                                           |

### 3. Фронтенд

```powershell
cd frontend
npm install
npm run dev
```

Приложение откроется на `http://localhost:3000`. Next.js проксирует запросы `/api/*` на `http://localhost:8080`, поэтому CORS для браузера не нужен.

Если бэкенд запущен на другом адресе:

```powershell
$env:API_URL="http://localhost:9090"
npm run dev
```

## Структура

```
habit/
├── backend/
│   ├── cmd/api/                  # HTTP-сервер
│   ├── cmd/seed/                 # демо-данные
│   └── internal/
│       ├── api/                  # роутер, хендлеры, middleware
│       ├── config/               # конфигурация из env
│       ├── database/             # пул подключений и миграции
│       ├── models/               # доменные модели
│       └── store/                # запросы к PostgreSQL
├── frontend/
│   └── src/
│       ├── app/                  # страницы: Сегодня, Привычки, Категории, Статистика
│       ├── components/           # UI и модальные окна
│       ├── hooks/                # SWR-хелперы
│       └── lib/                  # API-клиент, типы, работа с датами
├── docker-compose.yml            # PostgreSQL для локальной разработки
└── README.md
```

## Схема базы

```sql
categories (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
)

habits (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

habit_completions (
    id         BIGSERIAL PRIMARY KEY,
    habit_id   BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (habit_id, date)
)
```

Особенности:

- На один день у привычки — одна отметка. Сохранение через `PUT /api/completions` делает upsert по паре `(habit_id, date)`.
- Удаление привычки каскадно удаляет её историю; категорию с привычками удалить нельзя (`409`).
- Статусы: `done` — выполнено, `skipped` — пропущено. Отсутствие записи означает «нет отметки».
- Серия считается по подряд идущим дням со статусом `done`; пропуск или отсутствие отметки прерывают серию.

## API

| Метод    | Путь                          | Описание |
| -------- | ----------------------------- | -------- |
| `GET`    | `/api/health`                 | Проверка живости |
| `GET`    | `/api/categories`             | Категории с количеством привычек |
| `POST`   | `/api/categories`             | Создать категорию `{ "name": "..." }` |
| `PATCH`  | `/api/categories/{id}`        | Переименовать категорию |
| `DELETE` | `/api/categories/{id}`        | Удалить пустую категорию |
| `GET`    | `/api/habits?categoryId=1`    | Привычки, опционально по категории |
| `POST`   | `/api/habits`                 | Создать привычку `{ name, description, categoryId }` |
| `GET`    | `/api/habits/{id}`            | Одна привычка |
| `PATCH`  | `/api/habits/{id}`            | Обновить привычку |
| `DELETE` | `/api/habits/{id}`            | Удалить привычку и её историю |
| `GET`    | `/api/completions?from=...&to=...&habitId=...` | Отметки за период |
| `PUT`    | `/api/completions`            | Upsert отметки `{ habitId, date, status, note }` |
| `DELETE` | `/api/completions?habitId=1&date=2026-11-04` | Убрать отметку |
| `GET`    | `/api/dashboard?date=2026-11-04` | День: привычки по категориям, неделя, серии, сводка |
| `GET`    | `/api/stats?days=30&to=2026-11-04` | Статистика: сводка, дни, история по привычкам |

Даты — строки `YYYY-MM-DD`, время — ISO 8601. Ошибки возвращаются в виде `{ "error": "текст" }` с подходящим HTTP-статусом.

## Страницы

- **Сегодня** — прогресс дня, привычки по категориям, недельная сетка, серии, заметки; можно листать дни назад.
- **Привычки** — карточки всех привычек, фильтр по категориям и поиск, создание, редактирование и удаление.
- **Категории** — управление категориями и переход к привычкам категории.
- **Статистика** — выполнение за 7/30/90 дней, тепловая карта по каждой привычке, сильные и слабые места.

## Полезные команды

```powershell
# бэкенд
cd backend
go build ./...
go vet ./...
gofmt -w .

# фронтенд
cd frontend
npm run lint
npm run build
npm run start
```

## Ограничения

Проект рассчитан на одного локального пользователя: авторизации, аккаунтов и разделения данных нет. Демо-данные создаются отдельной командой и не попадают в прод автоматически.
