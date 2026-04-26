/**
 * Базовый класс парсера. Каждый источник вакансий наследует от него.
 *
 * Контракт метода normalizeJob() — возвращаемый объект:
 * {
 *   externalId:      string,   // id на источнике
 *   source:          string,   // 'hh' | 'tg' | 'superjob' | 'habr'
 *   url:             string,   // прямая ссылка
 *   title:           string,
 *   company:         string | null,
 *   description:     string | null,
 *   salaryMin:       number | null,
 *   salaryMax:       number | null,
 *   salaryCurrency:  string,   // default 'RUB'
 *   location:        string | null,
 *   remote:          boolean,
 *   experience:      'intern' | 'no_experience' | 'between1And3' | null,
 *   employment:      'full' | 'part' | 'contract' | null,
 *   stack:           string[],
 *   publishedAt:     Date,
 *   raw:             object,   // исходный объект от API (для дебага)
 * }
 */
export class BaseParser {
  constructor(sourceName) {
    this.sourceName = sourceName;
  }

  /**
   * Получить список вакансий из источника.
   * @param {object} filters — фильтры (keywords, experience и т.д.)
   * @returns {Promise<object[]>} массив нормализованных Job-объектов
   */
  async fetchJobs(filters) {
    throw new Error(`fetchJobs() не реализован в парсере "${this.sourceName}"`);
  }

  /**
   * Привести сырой объект от источника к единому Job-формату.
   * @param {object} rawJob — объект как пришёл от API / парсера
   * @returns {object} нормализованный Job
   */
  normalizeJob(rawJob) {
    throw new Error(`normalizeJob() не реализован в парсере "${this.sourceName}"`);
  }

  /**
   * Хелпер: сохранить массив Job-объектов в БД через upsert.
   * Реализован здесь, чтобы все парсеры не дублировали эту логику.
   * @param {object[]} jobs
   */
  async saveJobs(jobs) {
    const { query } = await import('../db/connection.js');
    for (const job of jobs) {
      await query(
        `INSERT INTO jobs
           (external_id, source, url, title, company, description,
            salary_min, salary_max, salary_currency,
            location, remote, experience, employment, stack, published_at, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (source, external_id) DO UPDATE
           SET url = EXCLUDED.url,
               title = EXCLUDED.title,
               company = EXCLUDED.company,
               description = EXCLUDED.description,
               salary_min = EXCLUDED.salary_min,
               salary_max = EXCLUDED.salary_max,
               salary_currency = EXCLUDED.salary_currency,
               location = EXCLUDED.location,
               remote = EXCLUDED.remote,
               experience = EXCLUDED.experience,
               employment = EXCLUDED.employment,
               stack = ARRAY(
                 SELECT DISTINCT tag
                 FROM unnest(COALESCE(jobs.stack, '{}') || COALESCE(EXCLUDED.stack, '{}')) AS tag
               ),
               published_at = EXCLUDED.published_at,
               raw = EXCLUDED.raw,
               fetched_at = NOW()`,
        [
          job.externalId, job.source, job.url, job.title, job.company,
          job.description, job.salaryMin, job.salaryMax, job.salaryCurrency ?? 'RUB',
          job.location, job.remote ?? false, job.experience, job.employment,
          job.stack ?? [], job.publishedAt, JSON.stringify(job.raw),
        ]
      );
    }
  }
}
