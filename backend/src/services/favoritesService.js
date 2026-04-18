import { query } from '../db/connection.js';

/**
 * Получить избранные вакансии пользователя
 */
export async function getFavorites(userId) {
  const result = await query(
    `
    SELECT j.*
    FROM favorites f
    JOIN jobs j ON j.id = f.job_id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

/**
 * Добавить в избранное
 */
export async function addFavorite(userId, jobId) {
  try {
    const result = await query(
      `
      INSERT INTO favorites (user_id, job_id)
      VALUES ($1, $2)
      RETURNING id
      `,
      [userId, jobId]
    );

    return result.rows[0].id;
  } catch (err) {
    if (err.code === '23505') {
      // unique violation
      throw { code: 'ALREADY_FAVORITED', message: 'Already in favorites' };
    }
    throw err;
  }
}

/**
 * Удалить из избранного
 */
export async function removeFavorite(userId, jobId) {
  await query(
    `
    DELETE FROM favorites
    WHERE user_id = $1 AND job_id = $2
    `,
    [userId, jobId]
  );
}