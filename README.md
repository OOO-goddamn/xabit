# Привычка

Спокойный трекер привычек: категории, ежедневные отметки, заметки, серии, статистика и напоминания о привычках.

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
2. **Settings → Secrets and variables → Actions → Variables** — на вкладке **Variables** (не в **Environments**!) создайте переменную `API_URL` с публичным адресом бэкенда, например `https://api.example.com`. Достаточно одной переменной `API_URL`; `NEXT_PUBLIC_API_URL` workflow подставляет сам.
3. Запушьте изменения в `main` — сайт появится по адресу `https://<user>.github.io/<repo>/`.

> **Важно:** переменные, добавленные через **Settings → Environments → …**, доступны только тем job'ам, где явно указан `environment: <имя>`. Job сборки его не указывает, поэтому такие переменные для сборки не видны. Добавляйте `API_URL` на уровне репозитория (вкладка **Variables**), а не внутри Environment.

Особенности:

- сборка идёт с `STATIC_EXPORT=true` (`output: "export"`), поэтому Cache Components/PPR отключаются — они требуют Node.js-сервер;
- вместо прокси `/api/*` браузер обращается к бэкенду напрямую по `NEXT_PUBLIC_API_URL`. Значение подставляется в бандл на этапе сборки, поэтому после изменения `API_URL` нужно перезапустить workflow;
- `process.env` в браузере всегда пустой: Next.js заменяет только прямые обращения вида `process.env.NEXT_PUBLIC_API_URL` на строку. Проверять адрес нужно в собранном JS или в Network-вкладке DevTools, а не через `console.log(process.env)`;
- по умолчанию `CORS_ORIGINS=*`, то есть API принимает запросы с любого origin; если ограничиваете список, добавьте туда `https://<user>.github.io`;
- base path (`/<repo>`) подставляется автоматически через `actions/configure-pages`;
- локальная проверка: `$env:STATIC_EXPORT="true"; npm run build` → результат в `frontend/out`.

### Повторение привычек

У каждой привычки есть расписание — блок «Повторение» в форме создания/редактирования:

- **Каждый день** — привычка запланирована на любой день (поведение по умолчанию);
- **По дням недели** — выбранные дни, например только Пн и Ср (одна привычка может быть и раз в неделю, и два раза в неделю);
- **Раз в месяц** — выбранное число от 1 до 31. Если в месяце нет такого числа (29–31 в коротких месяцах), привычка попадает на последний день месяца.

Расписание хранится в `habits.repeat_type`, `habits.weekdays` (ISO-номера дней, 1 = понедельник) и `habits.month_day`.

Дни вне расписания:

- отмечаются бледной полупрозрачной галочкой, только если предыдущий запланированный день выполнен, — так галочка означает «ритм сохранён», а не выполнение в выходной;
- если предыдущий плановый день пропущен, ещё не выполнен или привычка только создана, день отдыха показывается пунктиром с тире и не выглядит как выполнение;
- в истории статистики день отдыха после выполненного планового дня закрашивается полупрозрачным зелёным, а остальные дни отдыха — пунктиром;
- не требуют отметки — кнопки выполнения и пропуска для них неактивны;
- не входят в «осталось сегодня», выполняемость и серии — серия растёт только за запланированные дни;
- не вызывают напоминаний ни в открытой вкладке, ни через Web Push.

### Количественные привычки

У привычки можно задать цель на день — например, 60 минут учёбы, 100 приседаний или 8000 шагов. В форме создания/редактирования это поля «Цель на день», «Единица измерения» и «Шаг кнопки +».

- В строке привычки видно `30 / 60 мин`, полосу прогресса, кнопки `−`/`+ шаг` и поле для точного значения.
- Любое значение больше нуля сохраняет прогресс дня: статус `progress` и поле `value` в `habit_completions`.
- При достижении цели статус становится `done`; явный пропуск остаётся `skipped` с нулевым значением.
- Серия, выполняемость и счётчики «за 30 дней» растут только когда цель достигнута. Частичные дни видны янтарным маркером в неделе и истории статистики.
- Нажатие на большой круг сразу засчитывает цель. Повторное нажатие на выполненной привычке убирает отметку.
- Частичный прогресс не считается выполнением: запланированное напоминание на этот день не отменяется. Явный пропуск напоминание отменяет.
- Привычки без цели (`target_value IS NULL`) работают как раньше — бинарно «выполнено / пропуск».

### Напоминания

У каждой привычки можно задать время напоминания — поле «Напоминание» в форме создания/редактирования. Оно хранится в `habits.reminder_time` (`TIME`) и трактуется в локальном часовом поясе устройства. Напоминание срабатывает только в запланированные по расписанию дни.

Работают два независимых механизма:

1. **Пока сайт открыт** — `ReminderScheduler` во фронтенде раз в 30 секунд проверяет привычки, у которых время наступило в последние 5 минут и которые ещё не отмечены. Показывает браузерное уведомление или всплывающее сообщение внутри приложения.
2. **Push при закрытом браузере** — бэкенд раз в 30 секунд проверяет те же привычки с учётом часового пояса подписки и отправляет Web Push через service worker. Для этого нужны VAPID-ключи (см. ниже). Если push включён в этом браузере, локальный планировщик молчит, чтобы не дублировать уведомления.

Повторно за день уведомление не показывается: локальный планировщик пишет отметку в `localStorage`, а бэкенд — в таблицу `reminder_deliveries`.

#### Push-уведомления при закрытом браузере (VAPID)

1. Сгенерируйте пару ключей один раз:

   ```powershell
   cd backend
   go run ./cmd/vapid
   ```

   Или через Docker. Команду нужно выполнять из корня репозитория (там, где лежит `docker-compose.yml`) при запущенном Docker; `--build` обязателен, если образ ещё не собирался после появления `cmd/vapid`:

   ```powershell
   docker compose run --rm --no-deps --build --entrypoint habit-vapid backend
   ```

   Команда выведет `VAPID_PUBLIC_KEY` и `VAPID_PRIVATE_KEY`.

2. Добавьте ключи и адрес фронтенда в `.env` рядом с `docker-compose.yml`:

   ```dotenv
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:you@example.com
   PUBLIC_APP_URL=https://xabit.nbfx.ru
   ```

   `PUBLIC_APP_URL` — адрес, который откроется при клике на уведомление. `VAPID_SUBJECT` — контакт администратора (`mailto:` или `https://`).

3. Перезапустите бэкенд:

   ```powershell
   docker compose up -d --build backend
   ```

4. На сайте нажмите **Push-уведомления** в боковом меню и разрешите уведомления. Рядом появится ссылка «Проверить уведомление»: она отправит тестовый push на все подписки пользователя.

Проверка, что ключи подхватились:

```powershell
curl.exe http://localhost:8080/api/push/config
# {"enabled":true,"publicKey":"..."}
```

Важно:

- Push работает только по HTTPS (или на `localhost`) и не работает в приватном режиме некоторых браузеров.
- На iPhone/iPad push доступен только в установленном на домашний экран PWA (iOS 16.4+); в обычной вкладке Safari подписка не создаётся.
- Часовой пояс берётся из браузера при подписке и обновляется при каждом входе. Если вы переехали в другой пояс, подписка синхронизируется при следующем открытии сайта.
- Ключи VAPID можно менять, но после их смены старые подписки станут недействительны: пользователям нужно заново включить push.
- Если ключи не заданы, `/api/push/config` возвращает `{"enabled":false}`, переключатель в интерфейсе скрыт, а напоминания продолжают работать только при открытой вкладке.

### Логи и диагностика фронтенда

Фронтенд на GitHub Pages статический, поэтому его логи не попадают на сервер. В приложение добавлен клиентский логгер:

- ловит ошибки JS (`window.onerror`), необработанные Promise rejection и ошибки рендера React;
- записывает неудачные запросы к API: метод, путь, статус, длительность и текст ошибки. Тела запросов и токены не логируются;
- хранит последние 200 записей в `localStorage` (ключ `habit:logs`) и никуда их не отправляет;
- успешные API-запросы и старт приложения пишутся только в подробном режиме.

Где смотреть:

1. **Консоль браузера** — F12 → Console, сообщения с префиксом `[habit]`.
2. **Страница `/debug`** — например `https://ooo-goddamn.github.io/xabit/debug/`. Доступна без входа, показывает записи с кнопками «Обновить», «Копировать», «Скачать JSON» и «Очистить».
3. **Подробный режим** — откройте `/debug/?debug=1` (с полной перезагрузкой страницы) или нажмите «Включить» на самой странице.

Логи привязаны к конкретному браузеру и устройству: у другого пользователя будут свои. Чтобы автоматически получать ошибки со всех устройств, нужен внешний сервис (Sentry/GlitchTip) или отправка логов на бэкенд.

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
│   ├── cmd/vapid/                # генерация VAPID-ключей для Web Push
│   └── internal/
│       ├── api/                  # роутер, хендлеры, middleware
│       ├── config/               # конфигурация из env
│       ├── database/             # пул подключений и миграции
│       ├── models/               # доменные модели
│       ├── push/                 # планировщик и отправка Web Push
│       └── store/                # запросы к PostgreSQL
├── frontend/
│   ├── public/sw.js              # service worker для push-уведомлений
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
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    category_id   BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    reminder_time TIME,
    repeat_type   TEXT NOT NULL DEFAULT 'daily'
                  CHECK (repeat_type IN ('daily', 'weekly', 'monthly')),
    weekdays      INT[] NOT NULL DEFAULT '{}',
    month_day     SMALLINT CHECK (month_day BETWEEN 1 AND 31),
    target_value  INT CHECK (target_value > 0),
    unit          TEXT NOT NULL DEFAULT '',
    step_value    INT NOT NULL DEFAULT 1 CHECK (step_value > 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)

habit_completions (
    id         BIGSERIAL PRIMARY KEY,
    habit_id   BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'progress')),
    value      INT NOT NULL DEFAULT 0 CHECK (value >= 0),
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (habit_id, date)
)

push_subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    timezone   TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

reminder_deliveries (
    subscription_id BIGINT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    habit_id        BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subscription_id, habit_id, date)
)
```

Особенности:

- На один день у привычки — одна отметка. Сохранение через `PUT /api/completions` делает upsert по паре `(habit_id, date)`.
- Удаление привычки каскадно удаляет её историю; категорию с привычками удалить нельзя (`409`).
- Статусы: `done` — выполнено, `skipped` — пропущено, `progress` — есть частичный прогресс, цель не достигнута. Отсутствие записи означает «нет отметки».
- `value` хранит количество за день; у бинарных привычек всегда `0`.
- Серия считается по подряд идущим запланированным дням со статусом `done`; пропуск, частичный прогресс или отсутствие отметки прерывают серию.

## API

| Метод    | Путь                          | Описание |
| -------- | ----------------------------- | -------- |
| `GET`    | `/api/health`                 | Проверка живости |
| `GET`    | `/api/categories`             | Категории с количеством привычек |
| `POST`   | `/api/categories`             | Создать категорию `{ "name": "..." }` |
| `PATCH`  | `/api/categories/{id}`        | Переименовать категорию |
| `DELETE` | `/api/categories/{id}`        | Удалить пустую категорию |
| `GET`    | `/api/habits?categoryId=1`    | Привычки, опционально по категории |
| `POST`   | `/api/habits`                 | Создать привычку `{ name, description, categoryId, reminderTime, targetValue, unit, stepValue, repeat, weekdays, monthDay }` |
| `GET`    | `/api/habits/{id}`            | Одна привычка |
| `PATCH`  | `/api/habits/{id}`            | Обновить привычку (`reminderTime` — `"HH:MM"` или `""`; `targetValue` — число или `null`) |
| `DELETE` | `/api/habits/{id}`            | Удалить привычку и её историю |
| `GET`    | `/api/completions?from=...&to=...&habitId=...` | Отметки за период |
| `PUT`    | `/api/completions`            | Upsert отметки `{ habitId, date, status, value, note }` |
| `DELETE` | `/api/completions?habitId=1&date=2026-11-04` | Убрать отметку |
| `GET`    | `/api/dashboard?date=2026-11-04` | День: привычки по категориям, неделя, серии, сводка |
| `GET`    | `/api/stats?days=30&to=2026-11-04` | Статистика: сводка, дни, история по привычкам |
| `GET`    | `/api/push/config`            | `{ enabled, publicKey }` — настройки Web Push |
| `POST`   | `/api/push/subscriptions`     | Сохранить подписку `{ endpoint, keys: { p256dh, auth }, timezone }` |
| `DELETE` | `/api/push/subscriptions`     | Удалить подписку `{ endpoint }` |
| `POST`   | `/api/push/test`              | Отправить тестовый push на все устройства пользователя |

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

- Демо-данные создаются отдельной командой и не попадают в прод автоматически.
- Push-уведомления требуют HTTPS (или `localhost`) и VAPID-ключей на бэкенде. Без ключей напоминания работают только при открытой вкладке.
- На iOS push доступен только в установленном на домашний экран PWA (iOS 16.4+).
- Часовой пояс подписки обновляется при открытии сайта. Если устройство долго не заходило в приложение после переезда в другой пояс, напоминание может прийти по старому времени.
