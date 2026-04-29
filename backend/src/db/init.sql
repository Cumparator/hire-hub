-- =============================================================
--  Hire Hub — инициализация БД
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
--  Таблица вакансий
-- =============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id      TEXT          NOT NULL UNIQUE,
  source           TEXT          NOT NULL,
  url              TEXT          NOT NULL,
  title            TEXT          NOT NULL,
  company          TEXT,
  description      TEXT,
  salary_min       INTEGER,
  salary_max       INTEGER,
  salary_currency  TEXT          NOT NULL DEFAULT 'RUB',
  location         TEXT,
  remote           BOOLEAN       NOT NULL DEFAULT false,
  experience       TEXT,
  employment       TEXT,
  stack            TEXT[]        NOT NULL DEFAULT '{}',
  published_at     TIMESTAMPTZ   NOT NULL,
  fetched_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  raw              JSONB,
  CONSTRAINT jobs_source_external_id_key UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS jobs_source_idx      ON jobs (source);
CREATE INDEX IF NOT EXISTS jobs_remote_idx      ON jobs (remote);
CREATE INDEX IF NOT EXISTS jobs_experience_idx  ON jobs (experience);
CREATE INDEX IF NOT EXISTS jobs_salary_min_idx  ON jobs (salary_min);
CREATE INDEX IF NOT EXISTS jobs_published_idx   ON jobs (published_at DESC);
CREATE INDEX IF NOT EXISTS jobs_stack_idx       ON jobs USING GIN (stack);
CREATE INDEX IF NOT EXISTS jobs_title_fts_idx
  ON jobs USING GIN (to_tsvector('russian', title));

-- =============================================================
--  Таблица пользователей
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  login            TEXT          NOT NULL UNIQUE,
  password_hash    TEXT          NOT NULL,   -- формат: salt:hash (pbkdf2)
  favorite_job_ids UUID[]        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_login_idx ON users (login);

-- =============================================================
--  Таблица сессий
-- =============================================================
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT          PRIMARY KEY,
  user_id    UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ   NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

-- =============================================================
--  Таблица аналитики
-- =============================================================
CREATE TABLE IF NOT EXISTS user_analytics (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_type TEXT          NOT NULL,   -- 'site_entry' | 'job_redirect' | 'site_leave'
  job_id     UUID          REFERENCES jobs (id) ON DELETE SET NULL,
  timestamp  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_user_idx  ON user_analytics (user_id);
CREATE INDEX IF NOT EXISTS analytics_event_idx ON user_analytics (event_type);
CREATE INDEX IF NOT EXISTS analytics_time_idx  ON user_analytics (timestamp DESC);

-- =============================================================
--  Таблица счётчиков кликов
-- =============================================================
CREATE TABLE IF NOT EXISTS job_click_stats (
  user_id      UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id       UUID          NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  click_count  INTEGER       NOT NULL DEFAULT 1,
  last_click_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);

-- =============================================================
--  Таблица избранного (оставляем как есть для совместимости)
-- =============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT          NOT NULL,
  job_id      UUID          NOT NULL    REFERENCES jobs (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT favorites_user_job_key UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites (user_id);
