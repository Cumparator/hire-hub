import { getJobs, getJobById } from '../services/jobsService.js';
import { getFavorites, addFavorite, removeFavorite } from '../services/favoritesService.js';

/**
 * @param {import('express').Express} app
 */
export function registerRoutes(app) {

  // --- Jobs ---

  // GET /api/jobs?q=&stack=&remote=&experience=&salary_from=&page=&per_page=
  app.get('/api/jobs', async (req, res) => {
    try {
      const result = await getJobs(req.query);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message, code: 'INVALID_PARAMS' });
    }
  });

  // GET /api/jobs/:id
  app.get('/api/jobs/:id', async (req, res) => {
    const job = await getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found', code: 'JOB_NOT_FOUND' });
    res.json(job);
  });

  // --- Favorites ---
  // MVP: авторизация через заголовок X-User-Id (без JWT)

  // GET /api/favorites
  app.get('/api/favorites', requireUser, async (req, res) => {
    const jobs = await getFavorites(req.userId);
    res.json({ jobs });
  });

  // POST /api/favorites  body: { jobId }
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

  // DELETE /api/favorites/:jobId
  app.delete('/api/favorites/:jobId', requireUser, async (req, res) => {
    await removeFavorite(req.userId, req.params.jobId);
    res.sendStatus(204);
  });
}

/** Middleware: извлекает userId из заголовка X-User-Id */
function requireUser(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'X-User-Id header required', code: 'UNAUTHORIZED' });
  req.userId = userId;
  next();
}
