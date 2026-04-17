import { BaseParser } from './BaseParser.js';

// Документация HH.ru API: https://api.hh.ru/openapi/redoc
const HH_API_BASE = 'https://api.hh.ru';

// Маппинг experience-ключей HH → наш формат
const EXPERIENCE_MAP = {
  noExperience:     'no_experience',
  between1And3:     'between1And3',
  noMatter:         null,
  // intern — HH не имеет явного поля, фильтруем по ключевым словам в тайтле
};

export class HhParser extends BaseParser {
  constructor() {
    super('hh');
  }

  /**
   * @param {object} filters
   * @param {string} [filters.text]        — поисковая строка
   * @param {string} [filters.experience]  — 'noExperience' | 'between1And3'
   * @param {boolean}[filters.remote]
   * @param {number} [filters.salaryFrom]
   */
  async fetchJobs(filters = {}) {
    const params = new URLSearchParams({
      text:         filters.text ?? 'junior',
      area:         '113',              // 113 = Россия
      per_page:     '100',
      order_by:     'publication_time',
    });

    if (filters.experience) params.set('experience', filters.experience);
    if (filters.remote)     params.set('schedule', 'remote');
    if (filters.salaryFrom) params.set('salary', String(filters.salaryFrom));

    // HH возвращает max 2000 результатов (20 страниц по 100)
    const allJobs = [];
    let page = 0;
    let pages = 1;

    while (page < pages && page < 20) {
      params.set('page', String(page));
      const resp = await fetch(`${HH_API_BASE}/vacancies?${params}`);
      if (!resp.ok) throw new Error(`HH API error: ${resp.status}`);
      const data = await resp.json();

      pages = data.pages;
      for (const item of data.items) {
        allJobs.push(this.normalizeJob(item));
      }
      page++;
    }

    await this.saveJobs(allJobs);
    return allJobs;
  }

  normalizeJob(raw) {
    return {
      externalId:     String(raw.id),
      source:         'hh',
      url:            raw.alternate_url,
      title:          raw.name,
      company:        raw.employer?.name ?? null,
      description:    null,             // в списке нет описания, грузим отдельно при необходимости
      salaryMin:      raw.salary?.from ?? null,
      salaryMax:      raw.salary?.to   ?? null,
      salaryCurrency: raw.salary?.currency ?? 'RUB',
      location:       raw.area?.name ?? null,
      remote:         raw.schedule?.id === 'remote',
      experience:     EXPERIENCE_MAP[raw.experience?.id] ?? null,
      employment:     raw.employment?.id === 'full' ? 'full' : null,
      stack:          extractStack(raw.snippet),
      publishedAt:    new Date(raw.published_at),
      raw,
    };
  }
}

/** Достаём технологии из snippet.requirement и snippet.responsibility */
function extractStack(snippet) {
  if (!snippet) return [];
  const text = `${snippet.requirement ?? ''} ${snippet.responsibility ?? ''}`.toLowerCase();

  // Грубый список — потом можно вынести в конфиг
  const KNOWN_STACK = [
    'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'c++', 'c#',
    'react', 'vue', 'angular', 'next.js', 'nuxt',
    'node.js', 'fastapi', 'django', 'flask', 'spring',
    'postgresql', 'mysql', 'mongodb', 'redis',
    'docker', 'kubernetes', 'git', 'linux',
  ];

  return KNOWN_STACK.filter((tech) => text.includes(tech));
}
