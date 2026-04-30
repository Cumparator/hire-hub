// backend/src/api/routes.js

import { smartSearch }          from '../services/searchService.js';
import { getJobById }           from '../services/jobsService.js';
import { getFavorites,
         addFavorite,
         removeFavorite }       from '../services/favoritesService.js';
import { register,
         login,
         logout,
         getSession,
         AuthError }            from '../services/authService.js';

// ── Централизованный обработчик ошибок ────────────────────────────────────

/**
 * Превращает любой брошенный объект в стандартный JSON-ответ.
 *
 * Формат всегда:
 *   { "error": "Текст для пользователя", "code": "MACHINE_CODE" }
 *
 * AuthError — ожидаемые ошибки бизнес-логики (400 / 401 / 409).
 * Всё остальное — 500 Internal Server Error (детали не раскрываем).
 */
function handleError(res, err) {
  if (err instanceof AuthError) {
    return res.status(err.status).json({
      error: err.message,
      code:  err.code,
    });
  }
  return res.status(500).json({
    error: err.message || 'Внутренняя ошибка сервера',
    code:  'INTERNAL_ERROR',
  });
}

// ── Middleware: требуем авторизацию ──────────────────────────────────────

async function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  const session = await getSession(token).catch(() => null);

  if (!session) {
    return res.status(401).json({
      error: 'Необходима авторизация',
      code:  'UNAUTHORIZED',
    });
  }

  req.user = session.user;
  next();
}

// ── Регистрация маршрутов ────────────────────────────────────────────────

export function registerRoutes(app) {

  // ── Вакансии ─────────────────────────────────────────────────────────────

  app.get('/api/jobs', async (req, res) => {
    try {
      const result = await smartSearch(req.query);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  app.get('/api/jobs/:id', async (req, res) => {
    try {
      const job = await getJobById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Вакансия не найдена', code: 'NOT_FOUND' });
      res.json(job);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ── Избранное ─────────────────────────────────────────────────────────────

  app.get('/api/favorites', requireAuth, async (req, res) => {
    try {
      const jobs = await getFavorites(req.user.id);
      res.json({ jobs });
    } catch (err) {
      handleError(res, err);
    }
  });

  app.post('/api/favorites', requireAuth, async (req, res) => {
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'Укажите jobId', code: 'MISSING_JOB_ID' });
    }
    try {
      const fav = await addFavorite(req.user.id, jobId);
      res.status(201).json({ favoriteId: fav.id });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Уже в избранном', code: 'ALREADY_FAVORITE' });
      }
      if (err.code === '23503') {
        return res.status(404).json({ error: 'Вакансия не найдена', code: 'NOT_FOUND' });
      }
      handleError(res, err);
    }
  });

  app.delete('/api/favorites/:jobId', requireAuth, async (req, res) => {
    try {
      await removeFavorite(req.user.id, req.params.jobId);
      res.sendStatus(204);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ── Аутентификация ────────────────────────────────────────────────────────

  // Общие настройки cookie
  const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
  };

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { login, password } = req.body ?? {};
      const result = await register(login, password);

      res.cookie('session', result.token, {
        ...COOKIE_OPTS,
        expires: result.expires,
      });
      res.status(201).json({ user: result.user });
    } catch (err) {
      handleError(res, err);
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { login: userLogin, password } = req.body ?? {};
      const result = await login(userLogin, password);

      res.cookie('session', result.token, {
        ...COOKIE_OPTS,
        expires: result.expires,
      });
      res.json({ user: result.user });
    } catch (err) {
      handleError(res, err);
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      await logout(req.cookies?.session);
      res.clearCookie('session', { path: '/' });
      res.sendStatus(204);
    } catch (err) {
      handleError(res, err);
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const session = await getSession(req.cookies?.session);
      if (!session) return res.status(401).json({ error: 'Не авторизован', code: 'UNAUTHORIZED' });
      res.json({ user: session.user });
    } catch (err) {
      handleError(res, err);
    }
  });
}