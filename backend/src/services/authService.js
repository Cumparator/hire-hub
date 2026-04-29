// backend/src/services/authService.js

import { query } from '../db/connection.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  sessionExpiresAt,
} from './authUtils.js';

// ── Регистрация ──────────────────────────────────────────────────────────────

export async function register(login, password) {
  if (!login || login.trim().length < 3) {
    throw { code: 'INVALID_LOGIN', message: 'Логин должен быть не короче 3 символов' };
  }
  if (!password || password.length < 6) {
    throw { code: 'INVALID_PASSWORD', message: 'Пароль должен быть не короче 6 символов' };
  }

  const passwordHash = hashPassword(password);

  let user;
  try {
    const result = await query(
      `INSERT INTO users (login, password_hash) VALUES ($1, $2) RETURNING id, login, created_at`,
      [login.trim(), passwordHash]
    );
    user = result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw { code: 'LOGIN_TAKEN', message: 'Этот логин уже занят' };
    }
    throw err;
  }

  const token = await createSession(user.id);
  return { user: publicUser(user), token };
}

// ── Вход ─────────────────────────────────────────────────────────────────────

export async function login(login, password) {
  const result = await query(
    `SELECT id, login, password_hash, created_at FROM users WHERE login = $1`,
    [login?.trim()]
  );
  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    throw { code: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' };
  }

  const token = await createSession(user.id);
  return { user: publicUser(user), token };
}

// ── Выход ─────────────────────────────────────────────────────────────────────

export async function logout(token) {
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

// ── Текущий пользователь по токену ───────────────────────────────────────────

export async function getUserByToken(token) {
  if (!token) return null;

  const result = await query(
    `SELECT u.id, u.login, u.favorite_job_ids, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

// ── Избранное ─────────────────────────────────────────────────────────────────

export async function getFavoriteJobIds(userId) {
  const result = await query(
    `SELECT favorite_job_ids FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.favorite_job_ids ?? [];
}

export async function addFavoriteForUser(userId, jobId) {
  await query(
    `UPDATE users
     SET favorite_job_ids = array_append(favorite_job_ids, $2::uuid)
     WHERE id = $1 AND NOT ($2::uuid = ANY(favorite_job_ids))`,
    [userId, jobId]
  );
}

export async function removeFavoriteForUser(userId, jobId) {
  await query(
    `UPDATE users
     SET favorite_job_ids = array_remove(favorite_job_ids, $2::uuid)
     WHERE id = $1`,
    [userId, jobId]
  );
}

// ── Аналитика ─────────────────────────────────────────────────────────────────

export async function trackEvent(userId, eventType, jobId = null) {
  await query(
    `INSERT INTO user_analytics (user_id, event_type, job_id) VALUES ($1, $2, $3)`,
    [userId, eventType, jobId]
  );
}

export async function trackJobClick(userId, jobId) {
  await query(
    `INSERT INTO job_click_stats (user_id, job_id, click_count, last_click_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (user_id, job_id)
     DO UPDATE SET
       click_count   = job_click_stats.click_count + 1,
       last_click_at = NOW()`,
    [userId, jobId]
  );
  await trackEvent(userId, 'job_redirect', jobId);
}

// ── Вспомогательные ───────────────────────────────────────────────────────────

async function createSession(userId) {
  const token     = generateSessionToken();
  const expiresAt = sessionExpiresAt();
  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  return token;
}

function publicUser(row) {
  return {
    id:             row.id,
    login:          row.login,
    favoriteJobIds: row.favorite_job_ids ?? [],
    createdAt:      row.created_at,
  };
}
