import { query } from '../db/connection.js';

export async function getJobs(params = {}) {
  const {
    q,
    remote,
    experience,
    employment,
    stack,
    salary,
    salary_from,
    page = 1,
    per_page = 20,
  } = params;

  const values = [];
  const conditions = [];
  const push = (val) => { values.push(val); return `$${values.length}`; };

  // freetext
  if (q) {
    const ph = push(`%${q.toLowerCase()}%`);
    conditions.push(`(LOWER(title) LIKE ${ph} OR LOWER(description) LIKE ${ph})`);
  }

  // remote
  if (remote === 'true')  conditions.push(`remote = true`);
  if (remote === 'false') conditions.push(`remote = false`);

  // experience — один или несколько через запятую
  if (experience) {
    const arr = String(experience).split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length === 1) {
      conditions.push(`experience = ${push(arr[0])}`);
    } else if (arr.length > 1) {
      conditions.push(`experience IN (${arr.map(v => push(v)).join(', ')})`);
    }
  }

  // employment — один или несколько через запятую
  if (employment) {
    const arr = String(employment).split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length === 1) {
      conditions.push(`employment = ${push(arr[0])}`);
    } else if (arr.length > 1) {
      conditions.push(`employment IN (${arr.map(v => push(v)).join(', ')})`);
    }
  }

  // stack: OR-фильтр с ILIKE, ORDER BY по количеству совпадений (AND-приоритет)
  // Важно: плейсхолдеры для WHERE и ORDER BY — одни и те же, не дублируем значения.
  let stackOrderExpr = null;
  if (stack) {
    const stackArr = stack.split(',').map(s => s.trim()).filter(Boolean);
    if (stackArr.length) {
      const phs = stackArr.map(tech => push(tech));

      // WHERE: хотя бы один тег совпадает
      conditions.push(`(${phs.map(ph => `${ph} ILIKE ANY(stack)`).join(' OR ')})`);

      // ORDER BY: используем те же $N — считаем сколько совпало
      stackOrderExpr = phs.map(ph => `(CASE WHEN ${ph} ILIKE ANY(stack) THEN 1 ELSE 0 END)`).join(' + ');
    }
  }

  // salary
  const rawSalary = salary || salary_from;
  if (rawSalary) {
    const s = String(rawSalary).trim();
    if (s.startsWith('>')) {
      const n = Number(s.slice(1));
      if (!isNaN(n)) conditions.push(`salary_min > ${push(n)}`);
    } else if (s.startsWith('<')) {
      const n = Number(s.slice(1));
      if (!isNaN(n)) conditions.push(`salary_max < ${push(n)}`);
    } else {
      const n = Number(s);
      if (!isNaN(n)) conditions.push(`salary_min >= ${push(n)}`);
    }
  }

  const where   = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = stackOrderExpr
    ? `ORDER BY (${stackOrderExpr}) DESC, published_at DESC`
    : `ORDER BY published_at DESC`;

  const limit  = Math.min(Math.max(Number(per_page) || 20, 1), 50);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  // Снимок values ДО добавления limit/offset — используется в COUNT-запросе
  const filterValues = [...values];

  const dataValues = [...values, limit, offset];
  const limitPh    = `$${dataValues.length - 1}`;
  const offsetPh   = `$${dataValues.length}`;

  const sql = `
    SELECT *
    FROM jobs
    ${where}
    ${orderBy}
    LIMIT ${limitPh}
    OFFSET ${offsetPh}
  `;

  const [result, countResult] = await Promise.all([
    query(sql, dataValues),
    query(`SELECT COUNT(*) FROM jobs ${where}`, filterValues),
  ]);

  const total = Number(countResult.rows[0].count);

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

export async function getJobById(id) {
  const result = await query(`SELECT * FROM jobs WHERE id = $1`, [id]);
  if (!result.rows[0]) return null;

  let jobRow = result.rows[0];

  // Магия Lazy Loading: если это вакансия с HH и описание короткое/без тегов, качаем фулл!
  if (jobRow.source === 'hh' && (!jobRow.description || !jobRow.description.includes('<'))) {
      try {
          const resp = await fetch(`https://api.hh.ru/vacancies/${jobRow.external_id}`, {
              headers: {
                  'User-Agent': process.env.HH_APP_NAME || 'HireHub/1.0 (contact@hirehub.dev)'
              }
          });
          
          if (resp.ok) {
              const data = await resp.json();
              if (data.description) {
                  // Кэшируем полное описание в нашу БД, чтобы второй раз не качать
                  await query(`UPDATE jobs SET description = $1 WHERE id = $2`, [data.description, id]);
                  jobRow.description = data.description;
              }
          }
      } catch (err) {
          console.error(`[jobsService] Ошибка загрузки фулл вакансии HH:`, err.message);
      }
  }

  return normalizeRow(jobRow);
}

export async function countJobsByStack(stack, source = 'hh') {
  const result = await query(
    `SELECT COUNT(*) FROM jobs WHERE source = $1 AND $2 ILIKE ANY(stack)`,
    [source, stack]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function saveJobs(jobs) {
  for (const job of jobs) {
    await query(`
      INSERT INTO jobs (
        external_id, source, url, title, company,
        description, salary_min, salary_max, salary_currency,
        location, remote, experience, employment, stack, published_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (source, external_id) DO NOTHING
    `, [
      job.externalId, job.source, job.url, job.title, job.company,
      job.description, job.salaryMin, job.salaryMax, job.salaryCurrency,
      job.location, job.remote, job.experience, job.employment,
      job.stack, job.publishedAt,
    ]);
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

export { normalizeRow };

const jobsService = { getJobs, getJobById, countJobsByStack, saveJobs };
export default jobsService;

export async function cleanupOldJobs() {
  const result = await query(
    `DELETE FROM jobs WHERE published_at < NOW() - INTERVAL '10 days'`
  );
  return result.rowCount;
}
