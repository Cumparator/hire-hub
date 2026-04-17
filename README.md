# Hire Hub — IT Junior Aggregator

Агрегатор вакансий для начинающих: единый поиск по HH.ru и Telegram-каналам.


**тут надо написать тз и всё такое**


---

## Быстрый старт

```bash
# 1. Запустить БД
docker compose up db -d

# 2. Бэкенд
cd backend && npm install && npm run dev

# 3. Фронтенд (открыть отдельный терминал)
cd frontend && npm install && npm run dev
```

Или всё сразу через Docker:

```bash
docker compose up --build
```

---

## Архитектура

```
Frontend (статика)
  └─ api/client.js  ──HTTP──▶  Backend Express
                                 ├─ GET /api/jobs
                                 ├─ POST /api/favorites
                                 └─ db/connection.js ──▶ PostgreSQL
                                                           ▲
                               CRON (30 мин)               │
                                 ├─ hhParser  ─────────────┤
                                 └─ tgParser  ─────────────┘
```

---

## Ключевые контракты

- **Единая модель Job** → `docs/db-schema.md`
- **REST API** → `docs/api-contracts.md`
- **Синтаксис поиска** → `docs/search-syntax.md`

> ⚠️ Менять поля `Job`-модели осторожно —
> это затрагивает парсеры, API и фронт одновременно.

---

## Переменные окружения

| Переменная     | Где используется | Пример |
|----------------|-----------------|--------|
| `DATABASE_URL` | backend         | `postgres://user:pass@localhost:5432/hirehub` |
| `PORT`         | backend         | `4000` |
| `CORS_ORIGIN`  | backend         | `http://localhost:3000` |
| `TG_CHANNELS`  | backend/parsers | `junior_jobs_it,it_work_ru` |
| `VITE_API_URL` | frontend        | `http://localhost:4000` |

---

## Правила команды

1. **Ветки**: `feat/<задача>`, `fix/<задача>`. PR → review → merge в `main`.
2. **Изменения в `Job`-модели или API-контрактах** — обязательно обновить `docs/`. хочу чтобы иишкам можно было только docs показывать
