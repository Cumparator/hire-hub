# Database Schema

## Таблица `jobs`

Единый нормализованный формат вакансии — центральный контракт всей команды.
Парсеры пишут в эту таблицу. API читает из неё. Фронт отображает её поля.

**Эту штуку надо будет подредактировать посмотрев все апишки которые мы используем**

```sql
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   TEXT NOT NULL,          -- id вакансии на источнике (напр. "98765432" на HH)
  source        TEXT NOT NULL,          -- 'hh' | 'tg' | 'superjob' | 'habr'
  url           TEXT NOT NULL,          -- прямая ссылка на оригинал
  title         TEXT NOT NULL,
  company       TEXT,
  description   TEXT,
  salary_min    INTEGER,                -- в рублях, NULL если не указано
  salary_max    INTEGER,
  salary_currency TEXT DEFAULT 'RUB',
  location      TEXT,                   -- 'Москва' | 'Удалённо' | NULL
  remote        BOOLEAN DEFAULT FALSE,
  experience    TEXT,                   -- 'intern' | 'no_experience' | 'between1And3' | NULL
  employment    TEXT,                   -- 'full' | 'part' | 'contract' | NULL
  stack         TEXT[],                 -- ['Python', 'FastAPI', 'PostgreSQL']
  published_at  TIMESTAMPTZ NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  raw           JSONB,                  -- исходный объект от API/парсера (для дебага)

  UNIQUE (source, external_id)
);

CREATE INDEX jobs_published_at_idx ON jobs (published_at DESC);
CREATE INDEX jobs_source_idx ON jobs (source);
CREATE INDEX jobs_stack_idx ON jobs USING GIN (stack);
```

## Таблица `users`

```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id      BIGINT UNIQUE,             -- Telegram user id (если авторизация через TG)
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Таблица `favorites`

```sql
CREATE TABLE favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, job_id)
);

CREATE INDEX favorites_user_id_idx ON favorites (user_id);
```

## Таблица `sources`

Список подключённых источников и метаданные последнего обхода.

```sql
CREATE TABLE sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,   -- 'hh' | 'tg_jschannel' | ...
  display_name  TEXT NOT NULL,
  last_fetched  TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT TRUE
);
```

---

## JavaScript-тип `Job` (используется на фронте и в API-ответах)

```typescript
// shared/types.ts (можно скопировать в frontend и использовать как JSDoc)
interface Job {
  id: string;
  source: 'hh' | 'tg' | 'superjob' | 'habr';
  url: string;
  title: string;
  company: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  location: string | null;
  remote: boolean;
  experience: 'intern' | 'no_experience' | 'between1And3' | null;
  employment: 'full' | 'part' | 'contract' | null;
  stack: string[];
  publishedAt: string; // ISO 8601
}
```

> ⚠️ Это центральный контракт.
> Изменение затрагивает парсеры, API и фронт одновременно.
