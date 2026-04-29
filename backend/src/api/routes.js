// backend/src/api/routes.js

import { getJobById } from '../services/jobsService.js';
import { smartSearch } from '../services/searchService.js';
import { getFavorites, addFavorite, removeFavorite } from '../services/favoritesService.js';
import {
  register,
  login,
  logout,
  getUserByToken,
  trackEvent,
  trackJobClick,
} from '../services/authService.js';

const COOKIE_NAME    = 'hh_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 дней в секундах

/**
 * @param {import('express').Express} app
 */
export function registerRoutes(app) {

  // ── Вакансии ────────────────────────────────────────────────────────────────

  app.get('/api/jobs', async (req, res) => {
    try {
      const result = await smartSearch(req.query);
      res.json(result);
    } catch (err) {
      console.error('[routes] /api/jobs error:', err);
      res.status(400).json({ error: err.message, code: 'INVALID_PARAMS' });
    }
  });

  app.get('/api/jobs/:id', async (req, res) => {
    const job = await getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found', code: 'JOB_NOT_FOUND' });
    res.json(job);
  });

  // POST /api/jobs/:id/track-click — трекинг перехода по вакансии
  app.post('/api/jobs/:id/track-click', requireAuth, async (req, res) => {
    try {
      await trackJobClick(req.user.id, req.params.id);
      res.sendStatus(204);
    } catch (err) {
      console.error('[routes] track-click error:', err);
      res.sendStatus(204); // не блокируем пользователя из-за аналитики
    }
  });

  // ── Избранное (старый механизм через X-User-Id, совместимость) ───────────────

  app.get('/api/favorites', requireUser, async (req, res) => {
    const jobs = await getFavorites(req.userId);
    res.json({ jobs });
  });

  app.post('/api/favorites', requireUser, async (req, res) => {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: 'jobId required', code: 'MISSING_JOB_ID' });
    try {
      const favoriteId = await addFavorite(req.userId, jobId);
      res.status(201).json({ favoriteId });
    } catch (err) {
      if (err.code === 'ALREADY_FAVORITED') return res.status(409).json(err);
      res.status(500).json({ error: 'Internal error', code: 'SERVER_ERROR' });
    }
  });

  app.delete('/api/favorites/:jobId', requireUser, async (req, res) => {
    await removeFavorite(req.userId, req.params.jobId);
    res.sendStatus(204);
  });

  // ── Авторизация ──────────────────────────────────────────────────────────────

  // POST /api/auth/register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { login: rawLogin, password } = req.body ?? {};
      const { user, token } = await register(rawLogin, password);
      setSessionCookie(res, token);
      res.status(201).json({ user });
    } catch (err) {
      const status = err.code === 'LOGIN_TAKEN' ? 409 : 400;
      res.status(status).json({ error: err.message, code: err.code });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { login: rawLogin, password } = req.body ?? {};
      const { user, token } = await login(rawLogin, password);
      setSessionCookie(res, token);
      res.json({ user });
    } catch (err) {
      res.status(401).json({ error: err.message, code: err.code });
    }
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) await logout(token);
    res.clearCookie(COOKIE_NAME);
    res.sendStatus(204);
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    const user  = await getUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    res.json({ user });
  });

  // ── Аналитика ────────────────────────────────────────────────────────────────

  // POST /api/analytics/event  { eventType: 'site_entry' | 'site_leave', jobId? }
  app.post('/api/analytics/event', requireAuth, async (req, res) => {
    try {
      const { eventType, jobId } = req.body ?? {};
      if (!['site_entry', 'site_leave', 'job_redirect'].includes(eventType)) {
        return res.status(400).json({ error: 'Unknown eventType', code: 'INVALID_EVENT' });
      }
      await trackEvent(req.user.id, eventType, jobId ?? null);
      res.sendStatus(204);
    } catch (err) {
      console.error('[routes] analytics error:', err);
      res.sendStatus(204); // не ломаем UX из-за аналитики
    }
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────

/** Проверяет сессионный cookie. Если нет — 401. */
async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const user  = await getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
  req.user = user;
  next();
}

async function requireUser(req, res, next) {
  // Сначала пробуем сессию
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const user = await getUserByToken(token);
    if (user) {
      req.userId = user.id;
      return next();
    }
  }
  // Fallback на X-User-Id (анонимный)
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  req.userId = userId;
  next();
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE * 1000, // ms
    // secure: true — включить при HTTPS
  });
}
