# Привычка

Спокойный трекер привычек: категории, ежедневные отметки, заметки, серии и статистика.

**Стек**

- Бэкенд: Go 1.25, стандартный `net/http`, PostgreSQL 17, `pgx/v5`
- Фронтенд: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SWR, lucide-react
- База: PostgreSQL, миграции встроены в Go-бинарник и применяются при старте

## Быстрый старт

### Бэкенд и база в Docker

```powershell
docker compose up -d --build
```

- API — `http://localhost:8080`
- PostgreSQL — `localhost:5432`

Сервис фронтенда в `docker-compose.yml` закомментирован, потому что фронтенд публикуется на GitHub Pages. Чтобы поднять его локально в Docker, раскомментируйте блок `frontend` — приложение откроется на `http://localhost:3000`.

Миграции применяются автоматически при старте бэкенда. Демо-данные (4 категории, 9 привычек и история отметок за 20 дней):

```powershell
docker compose run --rm --entrypoint habit-seed backend -force
```

Остановить: `docker compose down` (данные сохраняются в томе `habit_pgdata`).

### Локальная разработка

#### 1. PostgreSQL

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

#### 2. Бэкенд

```powershell
cd backend
go run ./cmd/api
```

API поднимется на `http://localhost:8080`. Миграции применяются автоматически при запуске.

Чтобы наполнить базу демо-данными:

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
| `CORS_ORIGINS` | `*` (все origin)                                                   |

#### 3. Фронтенд

```powershell
cd frontend
npm install
npm run dev
```

Приложение откроется на `http://localhost:3000`. Next.js проксирует запросы `/api/*` на `http://localhost:8080`, поэтому CORS для браузера не нужен.

В Docker-сборке фронтенд проксирует `/api/*` на `http://backend:8080` — этот адрес передаётся build-arg `API_URL` в `docker-compose.yml`.

Если бэкенд запущен на другом адресе:

```powershell
$env:API_URL="http://localhost:9090"
npm run dev
```

### GitHub Pages (статический фронтенд)

Workflow `.github/workflows/deploy-pages.yml` собирает фронтенд как статический сайт и публикует его на GitHub Pages при каждом пуше в `main`.

1. **Settings → Pages → Source** — выберите **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** — создайте переменную `API_URL` с публичным адресом бэкенда, например `https://api.example.com`.
3. Запушьте изменения в `main` — сайт появится по адресу `https://<user>.github.io/<repo>/`.

Особенности:

- сборка идёт с `STATIC_EXPORT=true` (`output: "export"`), поэтому Cache Components/PPR отключаются — они требуют Node.js-сервер;
- вместо прокси `/api/*` браузер обращается к бэкенду напрямую по `NEXT_PUBLIC_API_URL`. По умолчанию `CORS_ORIGINS=*`, то есть API принимает запросы с любого origin; если ограничиваете список, добавьте туда `https://<user>.github.io`;
- base path (`/<repo>`) подставляется автоматически через `actions/configure-pages`;
- локальная проверка: `$env:STATIC_EXPORT="true"; npm run build` → результат в `frontend/out`.

### HTTPS для бэкенда (Caddy)

GitHub Pages работает только по HTTPS, поэтому API тоже должен быть доступен по HTTPS — иначе браузер блокирует запросы как mixed content. В `docker-compose.yml` есть опциональный сервис Caddy, который сам получает сертификат Let's Encrypt.

1. A-запись поддомена (например `api.example.com`) должна указывать на IP сервера.
2. Порты `80` и `443` должны быть открыты снаружи.
3. На сервере (Linux) задайте домен и запустите Caddy:

```bash
export API_DOMAIN=api.example.com
docker compose --profile tls up -d --build
```

Или сохраните домен в `.env`, чтобы не задавать переменную каждый раз:

```bash
cp .env.example .env
# отредактируйте API_DOMAIN=api.example.com в .env
docker compose --profile tls up -d --build
```

> На Windows используется PowerShell-синтаксис: `$env:API_DOMAIN="api.example.com"`. В bash `$env:...` не работает — будет ошибка `command not found`.

Сертификат хранится в томе `caddy_data` и продлевается автоматически. Проверка:

```bash
curl https://api.example.com/api/health
```

4. В GitHub укажите `API_URL=https://api.example.com` и перезапустите workflow.

Если на сервере уже заняты порты 80/443 (nginx, другой сайт), либо остановите его, либо настройте проксирование на `backend:8080` в существующем веб-сервере. Порты `5432` и `8080` наружу открывать не обязательно — для работы через Caddy достаточно 80/443.

Если поддомен проксируется через Cloudflare, включите режим **Full (strict)** или переключите запись в **DNS only** (серое облако). В режиме Flexible возможен цикл редиректов HTTP↔HTTPS.

Логи Caddy и получение сертификата:

```bash
docker compose --profile tls logs -f caddy
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
├── .github/workflows/            # CI: деплой фронтенда на GitHub Pages
├── Caddyfile                     # HTTPS-прокси для API (профиль tls)
├── docker-compose.yml            # PostgreSQL, бэкенд и Caddy (фронтенд закомментирован)
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

Демо-данные создаются отдельной командой и не попадают в прод автоматически.
