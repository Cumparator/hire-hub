import { BaseParser } from './BaseParser.js';
import jobsService from '../services/jobsService.js';

const FULL_STACK_LIST = [
    'JavaScript', 'TypeScript', 'Node.js', 'React', 'Vue', 'Angular', 'Next.js',
    'Python', 'Django', 'FastAPI', 'Flask',
    'Java', 'Spring', 'Kotlin', 'Android', 'Swift', 'iOS',
    'Go', 'Rust', 'C++', 'C#', '.NET',
    'PHP', 'Laravel', 'Symfony',
    'DevOps', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB'
];

const MIN_JOBS_PER_STACK = 100;

export class HhParser extends BaseParser {
    constructor() {
        super('hh');
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
            'Referer': 'https://hh.ru/',
        };
    }

    async fetchJobs() {
        const allJobs = [];

        for (const stack of FULL_STACK_LIST) {
            const existingCount = await jobsService.countJobsByStack(stack, 'hh');

            if (existingCount >= MIN_JOBS_PER_STACK) {
                console.log(`[HhParser] Skipping ${stack}: already have ${existingCount} jobs.`);
                continue;
            }

            console.log(`[HhParser] Parsing ${stack}: only ${existingCount} in DB...`);

            try {
                const jobs = await this.#scrapeByStack(stack);
                if (jobs.length > 0) {
                    await this.saveJobs(jobs);
                    allJobs.push(...jobs);
                    console.log(`[HhParser] ${stack}: saved ${jobs.length} jobs`);
                } else {
                    console.log(`[HhParser] ${stack}: 0 jobs parsed`);
                }
            } catch (error) {
                console.error(`[HhParser] Failed to scrape ${stack}:`, error.message);
            }

            await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
        }

        return allJobs;
    }

    async #scrapeByStack(stackText) {
        const url = `https://hh.ru/search/vacancy?text=${encodeURIComponent(stackText + ' junior')}&area=113&order_by=publication_time&items_on_page=50`;
        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) throw new Error(`Status ${response.status}`);

        const html = await response.text();
        return this.#parseHtml(html, stackText);
    }

    #parseHtml(html, stackText) {
        const jobs = [];

        // Блоки вакансий: <div id="{vacancyId}" class="vacancy-card...">...</div>
        // Граница — следующий такой же div или пагинатор
        const blockRe = /<div id="(\d{6,12})" class="vacancy-card[^"]*">([\s\S]*?)(?=<div id="\d{6,12}" class="vacancy-card|<div class="pager)/g;
        let match;

        while ((match = blockRe.exec(html)) !== null) {
            const [, vacancyId, block] = match;

            const title = this.#extractDataQa(block, 'serp-item__title-text');
            if (!title) continue;

            const url = this.#extractHref(block, 'serp-item__title');
            const company = this.#extractDataQa(block, 'vacancy-serp__vacancy-employer-text');
            const address = this.#extractDataQa(block, 'vacancy-serp__vacancy-address');

            // Опыт: data-qa="vacancy-serp__vacancy-work-experience-noExperience" — суффикс после последнего "-"
            const expMatch = block.match(/data-qa="vacancy-serp__vacancy-work-experience-([^"]+)"/);
            const experience = expMatch ? this.#mapExperience(expMatch[1]) : null;

            // Зарплата — ищем числа рядом с ₽ или рублей
            const { salaryMin, salaryMax } = this.#extractSalary(block);

            // Remote — data-qa с "schedule" или текст "удалённо"/"remote"
            const remote = /удалённо|удаленно|remote/i.test(block);

            jobs.push({
                externalId:     vacancyId,
                source:         'hh',
                url:            url ? url.split('?')[0] : `https://hh.ru/vacancy/${vacancyId}`,
                title,
                company:        company || null,
                description:    null,
                salaryMin,
                salaryMax,
                salaryCurrency: 'RUB',
                location:       address || null,
                remote,
                experience,
                employment:     null,
                stack:          [stackText],
                publishedAt:    this.#extractDate(block),
                raw:            { vacancyId, stackText },
            });
        }

        return jobs;
    }

    // Вытащить текст из первого элемента с data-qa="<name>"
    #extractDataQa(html, name) {
        const re = new RegExp(`data-qa="${name}"[^>]*>([^<]{1,200})`);
        const m = html.match(re);
        return m ? this.#cleanText(m[1]) : null;
    }

    // Вытащить href из элемента с data-qa="<name>"
    #extractHref(html, name) {
        const re = new RegExp(`data-qa="${name}"[^>]*href="([^"]+)"`);
        const m = html.match(re)
            ?? html.match(new RegExp(`href="([^"]+)"[^>]*data-qa="${name}"`));
        return m ? m[1].replace(/&amp;/g, '&') : null;
    }

    #extractSalary(block) {
      // Вырезаем все HTML-теги и любые пробельные символы
      const cleanText = block.replace(/<[^>]+>/g, '').replace(/\s|&nbsp;|\u202F/g, '');
      
      // Ищем формат "80000–120000₽" или "80000-120000р"
      const salText = cleanText.match(/(\d{4,9})(?:–|-)(\d{4,9})[₽р]/i);
      if (salText) {
          return {
              salaryMin: parseInt(salText[1], 10),
              salaryMax: parseInt(salText[2], 10),
          };
      }
      
      const fromText = cleanText.match(/от(\d{4,9})[₽р]/i);
      if (fromText) {
          return { salaryMin: parseInt(fromText[1], 10), salaryMax: null };
      }
      
      const toText = cleanText.match(/до(\d{4,9})[₽р]/i);
      if (toText) {
          return { salaryMin: null, salaryMax: parseInt(toText[1], 10) };
      }
      
      return { salaryMin: null, salaryMax: null };
  }

    #mapExperience(hhKey) {
        const map = {
            noExperience:  'no_experience',
            between1And3:  'between1And3',
            between3And6:  'between1And3',
            moreThan6:     'between1And3',
        };
        return map[hhKey] ?? null;
    }

    #cleanText(str) {
        return str.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
    }

    #extractDate(block) {
      const dateStr = this.#extractDataQa(block, 'vacancy-serp__vacancy-date');
      if (!dateStr) return new Date();

      // Маппинг для формата "12 апреля"
      const months = { 'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11 };
      const match = dateStr.match(/(\d+)\s+([а-я]+)/i);
      
      if (match) {
          const day = parseInt(match[1], 10);
          const month = months[match[2].toLowerCase()];
          if (month !== undefined) {
              const now = new Date();
              return new Date(now.getFullYear(), month, day);
          }
      }
      return new Date(); // Фолбек на текущую дату, если парсинг не удался
  }
}
