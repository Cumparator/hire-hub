import { query } from '../db/connection.js';

/**
 * Получить список вакансий с фильтрацией
 * @param {object} params
 */
export async function getJobs(params = {}) {
  const {
    q,
    remote,
    experience,
    stack,
    salary_from,
    page = 1,
    per_page = 20,
  } = params;

  const values = [];
  const conditions = [];

  // --- фильтры ---

  if (q) {
    values.push(`%${q.toLowerCase()}%`);
    conditions.push(`(LOWER(title) LIKE $${values.length} OR LOWER(description) LIKE $${values.length})`);
  }

  if (remote === 'true') {
    conditions.push(`remote = true`);
  }

  if (experience) {
    values.push(experience);
    conditions.push(`experience = $${values.length}`);
  }

  if (stack) {
    const stackList = stack.split(',').map(s => s.trim().toLowerCase());
    stackList.forEach((tech) => {
      values.push(tech);
      conditions.push(`$${values.length} = ANY (stack)`);
    });
  }

  if (salary_from) {
    values.push(Number(salary_from));
    conditions.push(`salary_min >= $${values.length}`);
  }

  // --- WHERE ---
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // --- пагинация ---
  const limit = Math.min(Number(per_page), 50);
  const offset = (Number(page) - 1) * limit;

  values.push(limit, offset);

  const sql = `
    SELECT *
    FROM jobs
    ${where}
    ORDER BY published_at DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

  const result = await query(sql, values);

  // total count (без LIMIT)
  const countResult = await query(`SELECT COUNT(*) FROM jobs ${where}`, values.slice(0, values.length - 2));

  return {
    jobs: result.rows,
    pagination: {
      page: Number(page),
      perPage: limit,
      total: Number(countResult.rows[0].count),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
}

/**
 * Получить вакансию по ID
 */
export async function getJobById(id) {
  const result = await query(
    `SELECT * FROM jobs WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}