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
    salary,       // новый параметр: ">100000" | "<80000" | "90000"
    salary_from,  // legacy-параметр, оставляем для совместимости
    page = 1,
    per_page = 20,
  } = params;

  const values = [];
  const conditions = [];

  // Вспомогательная функция — добавляет значение и возвращает его placeholder
  const push = (val) => { values.push(val); return `$${values.length}`; };

  // --- freetext: поиск по title и description ---
  if (q) {
    const ph = push(`%${q.toLowerCase()}%`);
    conditions.push(`(LOWER(title) LIKE ${ph} OR LOWER(description) LIKE ${ph})`);
  }

  // --- remote ---
  if (remote === 'true')  conditions.push(`remote = true`);
  if (remote === 'false') conditions.push(`remote = false`);

  // --- experience ---
  if (experience) {
    conditions.push(`experience = ${push(experience)}`);
  }

  // --- stack: массив через @> (вакансия должна содержать ВСЕ запрошенные технологии) ---
  if (stack) {
    const stackArr = stack
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (stackArr.length) {
      // stack @> ARRAY[$1,$2,...] — «стек вакансии содержит все элементы массива»
      const placeholders = stackArr.map(tech => push(tech));
      conditions.push(`stack @> ARRAY[${placeholders.join(', ')}]::text[]`);
    }
  }

  // --- salary: парсим оператор > / < из строки ---
  const rawSalary = salary || salary_from;
  if (rawSalary) {
    const strVal = String(rawSalary).trim();
    if (strVal.startsWith('>')) {
      const num = Number(strVal.slice(1));
      if (!isNaN(num)) conditions.push(`salary_min > ${push(num)}`);
    } else if (strVal.startsWith('<')) {
      const num = Number(strVal.slice(1));
      if (!isNaN(num)) conditions.push(`salary_max < ${push(num)}`);
    } else {
      const num = Number(strVal);
      if (!isNaN(num)) conditions.push(`salary_min >= ${push(num)}`);
    }
  }

  // --- WHERE ---
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // --- пагинация ---
  const limit  = Math.min(Math.max(Number(per_page) || 20, 1), 50);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const dataValues  = [...values, limit, offset];
  const limitPh     = `$${dataValues.length - 1}`;
  const offsetPh    = `$${dataValues.length}`;

  const sql = `
    SELECT *
    FROM jobs
    ${where}
    ORDER BY published_at DESC
    LIMIT ${limitPh}
    OFFSET ${offsetPh}
  `;

  const result      = await query(sql, dataValues);
  const countResult = await query(`SELECT COUNT(*) FROM jobs ${where}`, values);
  const total       = Number(countResult.rows[0].count);

  return {
    jobs: result.rows.map(normalizeRow),
    pagination: {
      page:       Math.max(Number(page) || 1, 1),
      perPage:    limit,
      total,
      totalPages: Math.ceil(total / limit),
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
  return result.rows[0] ? normalizeRow(result.rows[0]) : null;
}

/**
 * Подсчет вакансий по конкретному стеку для проверки лимитов парсера
 */
export async function countJobsByStack(stack, source = 'hh') {
    const sql = `
        SELECT COUNT(*) 
        FROM jobs 
        WHERE source = $1 AND $2 ILIKE ANY(stack)
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
            ON CONFLICT (source, external_id) DO NOTHING
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


function normalizeRow(row) {
  return {
    id:             row.id,
    source:         row.source,
    url:            row.url,
    title:          row.title,
    company:        row.company,
    description:    row.description,
    salaryMin:      row.salary_min,
    salaryMax:      row.salary_max,
    salaryCurrency: row.salary_currency,
    location:       row.location,
    remote:         row.remote,
    experience:     row.experience,
    employment:     row.employment,
    stack:          row.stack,
    publishedAt:    row.published_at,
  };
}

const jobsService = {
  getJobs,
  getJobById,
  countJobsByStack,
  saveJobs
};

export default jobsService;

export async function cleanupOldJobs() {
  // Удаляем вакансии старше 10 дней
  const result = await query(
    `DELETE FROM jobs WHERE published_at < NOW() - INTERVAL '10 days'`
  );
  return result.rowCount;
}