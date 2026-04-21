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

  const currentValues = [...values];
  currentValues.push(limit, offset);

  const sql = `
    SELECT *
    FROM jobs
    ${where}
    ORDER BY published_at DESC
    LIMIT $${currentValues.length - 1}
    OFFSET $${currentValues.length}
  `;

  const result = await query(sql, currentValues);

  // total count (без LIMIT)
  const countResult = await query(`SELECT COUNT(*) FROM jobs ${where}`, values);

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

/**
 * Подсчет вакансий по конкретному стеку для проверки лимитов парсера
 */
export async function countJobsByStack(stack, source = 'hh') {
    const sql = `
        SELECT COUNT(*) 
        FROM jobs 
        WHERE source = $1 AND $2 = ANY(stack)
    `;
    // Используем query из connection.js вместо несуществующего pool
    const result = await query(sql, [source, stack.toLowerCase()]);
    return parseInt(result.rows[0].count, 10);
}

/**
 * Сохранение массива вакансий (Upsert)
 */
export async function saveJobs(jobs) {
    for (const job of jobs) {
        const sql = `
            INSERT INTO jobs (
                external_id, source, url, title, company, 
                description, salary_min, salary_max, salary_currency,
                location, remote, experience, employment, stack, published_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (external_id) DO NOTHING
        `;
        
        const values = [
            job.externalId, job.source, job.url, job.title, job.company,
            job.description, job.salaryMin, job.salaryMax, job.salaryCurrency,
            job.location, job.remote, job.experience, job.employment, 
            job.stack.map(s => s.toLowerCase()), job.publishedAt
        ];

        await query(sql, values);
    }
}