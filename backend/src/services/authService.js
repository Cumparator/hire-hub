// backend/src/services/authService.js
// Сервис аутентификации — регистрация, вход, управление сессиями.
// Все ошибки бросаются как объекты { status, code, message }, которые
// routes.js превращает в стандартный JSON-ответ.

import { query } from '../db/connection.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  sessionExpiresAt,
} from './authUtils.js';

// ── Константы валидации (зеркало фронта) ─────────────────────────────────
const MIN_LOGIN_LEN    = 3;
const MAX_LOGIN_LEN    = 32;
const MIN_PASSWORD_LEN = 6;
const MAX_PASSWORD_LEN = 72;
const LOGIN_RE         = /^[a-zA-Z0-9_\-.]+$/;

// ── Вспомогательный класс ошибки ─────────────────────────────────────────

export class AuthError extends Error {
  /**
   * @param {number} status  HTTP-статус
   * @param {string} code    Машинный код (используется фронтом)
   * @param {string} message Текст для пользователя
   */
  constructor(status, code, message) {
    super(message);
    this.status  = status;
    this.code    = code;
  }
}

// ── Серверная валидация полей ─────────────────────────────────────────────

function validateCredentials(login, password) {
  if (!login || typeof login !== 'string') {
    throw new AuthError(400, 'VALIDATION_ERROR', 'Введите логин');
  }
  if (!password || typeof password !== 'string') {
    throw new AuthError(400, 'VALIDATION_ERROR', 'Введите пароль');
  }

  const l = login.trim();

  if (l.length < MIN_LOGIN_LEN) {
    throw new AuthError(400, 'VALIDATION_ERROR',
      `Логин — минимум ${MIN_LOGIN_LEN} символа`);
  }
  if (l.length > MAX_LOGIN_LEN) {
    throw new AuthError(400, 'VALIDATION_ERROR',
      `Логин — не более ${MAX_LOGIN_LEN} символов`);
  }
  if (!LOGIN_RE.test(l)) {
    throw new AuthError(400, 'VALIDATION_ERROR',
      'Логин: только латиница, цифры, _ - .');
  }
  if (password.length < MIN_PASSWORD_LEN) {
    throw new AuthError(400, 'VALIDATION_ERROR',
      `Пароль — минимум ${MIN_PASSWORD_LEN} символов`);
  }
  if (password.length > MAX_PASSWORD_LEN) {
    throw new AuthError(400, 'VALIDATION_ERROR',
      `Пароль — не более ${MAX_PASSWORD_LEN} символов`);
  }

  return l;
}

// ── Регистрация ───────────────────────────────────────────────────────────

export async function register(rawLogin, password) {
  const login = validateCredentials(rawLogin, password);
  const hash  = hashPassword(password);

  let result;
  try {
    result = await query(
      `INSERT INTO users (login, password_hash)
       VALUES ($1, $2)
       RETURNING id, login, created_at`,
      [login, hash]
    );
  } catch (err) {
    if (err.code === '23505') {
      throw new AuthError(409, 'LOGIN_TAKEN', 'Этот логин уже занят');
    }
    throw err; 
  }

  const user    = result.rows[0];
  const token   = generateSessionToken();
  const expires = sessionExpiresAt();

  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, user.id, expires]
  );

  return { user: { id: user.id, login: user.login }, token, expires };
}

// ── Вход ──────────────────────────────────────────────────────────────────

export async function login(rawLogin, password) {
  const login = validateCredentials(rawLogin, password);

  const result = await query(
    `SELECT id, login, password_hash FROM users WHERE login = $1`,
    [login]
  );

  if (result.rows.length === 0) {
    throw new AuthError(401, 'LOGIN_NOT_FOUND', 'Пользователь не найден');
  }

  const user = result.rows[0];

  if (!verifyPassword(password, user.password_hash)) {
    throw new AuthError(401, 'INVALID_PASSWORD', 'Неверный пароль');
  }

  await query(
    `DELETE FROM sessions WHERE user_id = $1 AND expires_at < NOW()`,
    [user.id]
  ).catch(() => {});

  const token   = generateSessionToken();
  const expires = sessionExpiresAt();

  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, user.id, expires]
  );

  return { user: { id: user.id, login: user.login }, token, expires };
}

// ── Выход ─────────────────────────────────────────────────────────────────

export async function logout(token) {
  if (!token) return;
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

// ── Проверка сессии ───────────────────────────────────────────────────────

export async function getSession(token) {
  if (!token) return null;

  const result = await query(
    `SELECT s.token, s.expires_at, u.id, u.login
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return { user: { id: row.id, login: row.login }, expiresAt: row.expires_at };
}