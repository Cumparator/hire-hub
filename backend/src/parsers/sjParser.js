// backend/src/parsers/sjParser.js

import { BaseParser } from './baseParser.js';
import jobsService from '../services/jobsService.js';

const SJ_API = 'https://api.superjob.ru/2.0';
const MIN_JOBS_PER_STACK = 100;

// Маппинг опыта (SJ id -> HireHub)
const EXPERIENCE_MAP = {
    1: 'no_experience',
    2: 'between1And3',
    3: 'between3And6',
    4: 'moreThan6',
};

const REVERSE_EXPERIENCE_MAP = {
    'no_experience': 1,
    'between1And3': 2,
    'between3And6': 3,
    'moreThan6': 4,
};

const FULL_STACK_LIST = [
    'JavaScript', 'TypeScript', 'Node.js', 'React', 'Vue', 'Angular', 'Next.js',
    'Python', 'Django', 'FastAPI', 'Flask',
    'Java', 'Spring', 'Kotlin', 'Android', 'Swift', 'iOS',
    'Go', 'Rust', 'C++', 'C#', '.NET',
    'PHP', 'Laravel', 'Symfony',
    'DevOps', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB',
];

export class SjParser extends BaseParser {
    constructor() {
        super('superjob');
    }

    async fetchJobs(filters = {}) {
        const token = process.env.SUPERJOB_TOKEN;
        if (!token) {
            console.warn('[SjParser] SUPERJOB_TOKEN не задан, пропускаем парсинг');
            return [];
        }

        const allJobs = [];
        const searchTargets = this.#buildSearchTargets(filters);

        for (const target of searchTargets) {
            const stack = target.stack;
            const existingCount = await jobsService.countJobsByStack(stack, 'superjob');

            if (existingCount >= MIN_JOBS_PER_STACK) {
                console.log(`[SjParser] Skipping ${stack}: already have ${existingCount} jobs`);
                continue;
            }

            console.log(`[SjParser] Parsing ${stack}: only ${existingCount} in DB...`);

            try {
                const jobs = await this.#fetchByApi(target, filters, token);
                if (jobs.length > 0) {
                    await this.saveJobs(jobs);
                    allJobs.push(...jobs);
                    console.log(`[SjParser] ${stack}: saved ${jobs.length} jobs`);
                } else {
                    console.log(`[SjParser] ${stack}: 0 jobs`);
                }
            } catch (err) {
                console.error(`[SjParser] ${stack}: ошибка —`, err.message);
            }

            // Небольшая задержка, чтобы не словить Rate Limit от SuperJob
            await new Promise(r => setTimeout(r, 500));
        }

        return allJobs;
    }

    #buildSearchTargets(filters) {
        const stacks = Array.isArray(filters.stacks) && filters.stacks.length
            ? filters.stacks
            : FULL_STACK_LIST;
        
        // Поддерживаем как query (от умного поиска на фронте), так и text (из cron.js)
        const query = (filters.query || filters.text)?.trim();

        return stacks.map((stack) => ({
            stack,
            keyword: query ? `${query} ${stack}`.trim() : stack,
        }));
    }

    async #fetchByApi(target, filters, token) {
        const jobs = [];
        let page = 0;
        let more = true;

        // Ограничиваем глубину 10 страницами (до 1000 вакансий на один тег за раз)
        while (more && page < 10) {
            const params = new URLSearchParams({
                keyword: target.keyword,
                count: '100',
                page: String(page),
                catalogues: '33', // Строго категория "IT, Интернет, связь, телеком" // мб убрать?
            });

            if (filters.schedule === 'remote') {
                params.append('place_of_work', '2'); // 2 - на дому / удаленная
            }
            
            // Прокидываем фильтр по опыту, только если он явно задан в запросе
            if (filters.experience && REVERSE_EXPERIENCE_MAP[filters.experience]) {
                params.append('experience', String(REVERSE_EXPERIENCE_MAP[filters.experience]));
            }

            const resp = await fetch(`${SJ_API}/vacancies/?${params}`, {
                headers: { 'X-Api-App-Id': token }
            });

            if (!resp.ok) throw new Error(`SJ API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
            const data = await resp.json();

            for (const item of data.objects) {
                jobs.push(this.#normalizeApiJob(item, target.stack));
            }

            more = data.more;
            page++;
            if (more) await new Promise(r => setTimeout(r, 350));
        }

        return jobs;
    }

    #normalizeApiJob(raw, stackText) {
        return {
            externalId: String(raw.id),
            source: 'superjob',
            url: raw.link,
            title: raw.profession,
            company: raw.firm_name || raw.client?.title || null,
            description: raw.candidat || null,
            salaryMin: raw.payment_from || null,
            salaryMax: raw.payment_to || null,
            salaryCurrency: (raw.currency || 'rub').toUpperCase(),
            location: raw.town?.title || null,
            remote: raw.place_of_work?.id === 2 || !!raw.place_of_work?.title?.toLowerCase().includes('удаленн'),
            experience: EXPERIENCE_MAP[raw.experience?.id] || null,
            employment: raw.type_of_work?.id === 6 ? 'full' : null,
            stack: [stackText],
            publishedAt: raw.date_published ? new Date(raw.date_published * 1000) : new Date(),
            raw,
        };
    }
}
