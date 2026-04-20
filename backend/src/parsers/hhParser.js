import { BaseParser } from './baseParser.js';

const HH_API_BASE = 'https://api.hh.ru';
const USER_AGENT = 'HireHub/1.0 (contact@hirehub.dev)';

const EXPERIENCE_MAP = {
  noExperience:   'no_experience',
  between1And3:   'between1And3',
  between3And6:   'between3And6',
  moreThan6:      'moreThan6'
};

const REVERSE_EXPERIENCE_MAP = Object.fromEntries(
  Object.entries(EXPERIENCE_MAP).map(([hhKey, ourKey]) => [ourKey, hhKey])
);

export class HhParser extends BaseParser {
  constructor() {
    super('hh');
  }

  async fetchJobs(filters = {}) {
    const params = new URLSearchParams({
      text:         filters.text || 'junior',
      area:         filters.area || '113', 
      per_page:     '100',
      order_by:     'publication_time',
    });

    if (filters.experience && REVERSE_EXPERIENCE_MAP[filters.experience]) {
      params.set('experience', REVERSE_EXPERIENCE_MAP[filters.experience]);
    } else if (filters.experience) {
      params.set('experience', filters.experience); 
    }

    if (filters.remote) {
      params.set('schedule', 'remote');
    }

    if (filters.salaryFrom) {
      params.set('salary', String(filters.salaryFrom));
      params.set('only_with_salary', 'true');
    }

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

        for (const item of data.items) {
          try {
            const detailedJob = await this.#fetchJobDetails(item.id);
            allJobs.push(this.normalizeJob(item, detailedJob));
          } catch (err) {
            console.warn(`[HhParser] Не удалось загрузить детали вакансии ${item.id}:`, err.message);
            allJobs.push(this.normalizeJob(item));
          }
        }
        page++;
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await this.saveJobs(allJobs);
      return allJobs;
    } catch (err) {
      console.error('[HhParser] Ошибка парсинга:', err.message);
      throw err;
    }
  }

  async #fetchJobDetails(vacancyId) {
    const resp = await fetch(`${HH_API_BASE}/vacancies/${vacancyId}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!resp.ok) return null;
    return await resp.json();
  }

  normalizeJob(raw, detailed = null) {
    const description = detailed?.description 
      ? detailed.description.replace(/<[^>]+>/g, ' ').trim() 
      : null;

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