# Frontend

Next.js 16 + TypeScript + Tailwind CSS 4. Запросы к Go API проксируются через rewrite `/api/*`.

```powershell
npm install
npm run dev
```

По умолчанию API ожидается на `http://localhost:8080`. Переопределить можно через `API_URL` (для rewrite) или `NEXT_PUBLIC_API_URL` (прямые запросы из браузера) — см. `.env.example`.

Подробности запуска и API — в [корневом README](../README.md).
