// backend/src/services/authUtils.js
// Утилиты безопасности без сторонних зависимостей — только Node.js crypto.

import crypto from 'crypto';

const ITERATIONS  = 100_000;
const KEY_LENGTH  = 64;
const DIGEST      = 'sha512';
const SESSION_TTL_DAYS = 30;

// ── Пароли ──────────────────────────────────────────────────────────────────

/**
 * Хэшируем пароль.
 * @returns {string} "salt:hash" — оба куска в hex
 */
export function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(plaintext, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Проверяем пароль против сохранённого "salt:hash".
 */
export function verifyPassword(plaintext, stored) {
  const [salt, expectedHash] = stored.split(':');
  if (!salt || !expectedHash) return false;
  const actualHash = crypto
    .pbkdf2Sync(plaintext, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex');
  // timingSafeEqual против timing-атак
  const a = Buffer.from(actualHash,   'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Сессии ───────────────────────────────────────────────────────────────────

/**
 * Генерируем случайный токен сессии (64 hex-символа).
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Возвращает дату истечения сессии.
 */
export function sessionExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d;
}
