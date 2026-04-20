import { BaseParser } from './baseParser.js';

// Документация HH.ru API: https://api.hh.ru/openapi/redoc
const HH_API_BASE = 'https://api.hh.ru';
const USER_AGENT = 'HireHub/1.0 (contact@hirehub.dev)';

// Маппинг experience-ключей HH → наш формат
const EXPERIENCE_MAP = {
  noExperience:     'no_experience',
  between1And3:     'between1And3',
  noMatter:         null,
};

export class HhParser extends BaseParser {
  constructor() {
    super('hh');
  }

  /**
   * Получение вакансий с HH.ru
   */
  async fetchJobs(filters = {}) {
    const params = new URLSearchParams({
      text:         filters.text ?? 'junior',
      area:         '113', // Россия
      per_page:     '100',
      order_by:     'publication_time',
    });

    if (filters.experience) params.set('experience', filters.experience);
    if (filters.remote)     params.set('schedule', 'remote');
    if (filters.salaryFrom) params.set('salary', String(filters.salaryFrom));

    const allJobs = [];
    let page = 0;
    let pages = 1;

    try {
      while (page < pages && page < 20) {
        params.set('page', String(page));
        const resp = await fetch(`${HH_API_BASE}/vacancies?${params}`, {
          headers: { 'User-Agent': USER_AGENT }
        });
        
        if (!resp.ok) throw new Error(`HH API error: ${resp.status}`);
        
        const data = await resp.json();
        pages = data.pages;

        // Для каждой вакансии получаем детали (описание и полный стек)
        for (const item of data.items) {
          try {
            const detailedJob = await this.#fetchJobDetails(item.id);
            allJobs.push(this.normalizeJob(item, detailedJob));
          } catch (err) {
            console.warn(`[HhParser] Не удалось загрузить детали вакансии ${item.id}:`, err.message);
            allJobs.push(this.normalizeJob(item)); // Сохраняем без описания, если не вышло
          }
        }
        page++;
        
        // Небольшая задержка, чтобы не поймать 429 Rate Limit
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await this.saveJobs(allJobs);
      return allJobs;
    } catch (err) {
      console.error('[HhParser] Ошибка парсинга:', err.message);
      throw err;
    }
  }

  /**
   * Получение детальной информации о вакансии (описание, ключевые навыки)
   */
  async #fetchJobDetails(vacancyId) {
    const resp = await fetch(`${HH_API_BASE}/vacancies/${vacancyId}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!resp.ok) return null;
    return await resp.json();
  }

  normalizeJob(raw, detailed = null) {
    const description = detailed?.description 
      ? detailed.description.replace(/<[^>]+>/g, ' ').trim() // Очистка от HTML
      : null;

    // Объединяем ключевые навыки из HH и наш поиск по тексту
    const hhSkills = detailed?.key_skills?.map(s => s.name.toLowerCase()) ?? [];
    const textToAnalyze = `${raw.name} ${description ?? ''} ${raw.snippet?.requirement ?? ''}`;
    const extractedStack = extractStack(textToAnalyze);
    
    const finalStack = [...new Set([...hhSkills, ...extractedStack])];

    return {
      externalId:     String(raw.id),
      source:         'hh',
      url:            raw.alternate_url,
      title:          raw.name,
      company:        raw.employer?.name ?? null,
      description:    description,
      salaryMin:      raw.salary?.from ?? null,
      salaryMax:      raw.salary?.to   ?? null,
      salaryCurrency: raw.salary?.currency ?? 'RUB',
      location:       raw.area?.name ?? null,
      remote:         raw.schedule?.id === 'remote',
      experience:     EXPERIENCE_MAP[raw.experience?.id] ?? null,
      employment:     raw.employment?.id === 'full' ? 'full' : null,
      stack:          finalStack,
      publishedAt:    new Date(raw.published_at),
      raw:            { ...raw, detailed_info: detailed },
    };
  }
}

/**
 * Извлечение технологий из текста
 */
function extractStack(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase();

  const KNOWN_STACK = [
    'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'c++', 'c#',
    'react', 'vue', 'angular', 'next.js', 'nuxt', 'node.js', 'express',
    'fastapi', 'django', 'flask', 'spring', 'postgresql', 'mysql', 'mongodb', 
    'redis', 'docker', 'kubernetes', 'git', 'linux', 'aws', 'azure'
  ];

  return KNOWN_STACK.filter((tech) => lowerText.includes(tech));
}