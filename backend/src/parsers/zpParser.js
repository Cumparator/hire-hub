// backend/src/parsers/zpParser.js

import { BaseParser } from './baseParser.js';
import jobsService from '../services/jobsService.js';

const HH_API = 'https://api.hh.ru';
const APP_NAME = process.env.HH_APP_NAME || 'HireHub/1.0 (contact@hirehub.dev)';

const EXPERIENCE_MAP = {
    noExperience: 'no_experience',
    between1And3: 'between1And3',
    between3And6: 'between3And6',
    moreThan6:    'moreThan6',
};

const REVERSE_EXPERIENCE_MAP = {
    no_experience: 'noExperience',
    between1And3: 'between1And3',
    between3And6: 'between3And6',
    moreThan6: 'moreThan6',
};

const FULL_STACK_LIST = [
    'JavaScript', 'TypeScript', 'Node.js', 'React', 'Vue', 'Angular', 'Next.js',
    'Python', 'Django', 'FastAPI', 'Flask',
    'Java', 'Spring', 'Kotlin', 'Android', 'Swift', 'iOS',
    'Go', 'Rust', 'C++', 'C#', '.NET',
    'PHP', 'Laravel', 'Symfony',
    'DevOps', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB',
];

const MIN_JOBS_PER_STACK = 100;

export class ZpParser extends BaseParser {
    constructor() {
        super('zarplata');
    }

    async fetchJobs(filters = {}) {
        const token = process.env.HH_TOKEN;
        if (!token) {
            console.warn('[ZpParser] HH_TOKEN не задан, парсинг Zarplata через API HH невозможен.');
            return [];
        }

        const allJobs = [];
        const searchTargets = this.#buildSearchTargets(filters);

        for (const target of searchTargets) {
            const stack = target.stack;
            const existingCount = await jobsService.countJobsByStack(stack, 'zarplata');

            if (existingCount >= MIN_JOBS_PER_STACK) {
                console.log(`[ZpParser] Skipping ${stack}: already have ${existingCount} jobs`);
                continue;
            }

            console.log(`[ZpParser] Parsing ${stack}: only ${existingCount} in DB...`);

            try {
                const jobs = await this.#fetchByApi(target, filters, token);
                if (jobs.length > 0) {
                    await this.saveJobs(jobs);
                    allJobs.push(...jobs);
                    console.log(`[ZpParser] ${stack}: saved ${jobs.length} jobs`);
                } else {
                    console.log(`[ZpParser] ${stack}: 0 jobs`);
                }
            } catch (err) {
                console.error(`[ZpParser] ${stack}: ошибка —`, err.message);
            }

            await new Promise(r => setTimeout(r, 500));
        }

        return allJobs;
    }

    #buildSearchTargets(filters) {
        const stacks = Array.isArray(filters.stacks) && filters.stacks.length
            ? filters.stacks
            : FULL_STACK_LIST;
        const query = (filters.query || filters.text)?.trim();

        return stacks.map((stack) => ({
            stack,
            text: query ? `${query} ${stack}`.trim() : stack,
        }));
    }

    async #fetchByApi(target, filters, token) {
        const jobs = [];
        let page = 0;
        let pages = 1;

        while (page < pages && page < 5) { // Ограничим 5 страницами для скорости
            const params = new URLSearchParams({
                text: target.text,
                area: '113', // Россия
                per_page: '100',
                page: String(page),
                order_by: 'publication_time',
                site: 'zarplata' // <-- МАГИЯ ЗДЕСЬ
            });

            if (filters.schedule === 'remote') {
                params.append('schedule', 'remote');
            }
            if (filters.experience && REVERSE_EXPERIENCE_MAP[filters.experience]) {
                params.append('experience', REVERSE_EXPERIENCE_MAP[filters.experience]);
            }

            const resp = await fetch(`${HH_API}/vacancies?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'HH-User-Agent': APP_NAME,
                    'User-Agent': APP_NAME,
                    'Accept': 'application/json',
                }
            });

            if (!resp.ok) throw new Error(`HH API (Zarplata) ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
            const data = await resp.json();

            pages = data.pages;
            for (const item of data.items) {
                jobs.push(this.#normalizeApiJob(item, target.stack));
            }

            page++;
            if (page < pages) await new Promise(r => setTimeout(r, 300));
        }

        return jobs;
    }

    #normalizeApiJob(raw, stackText) {
        const remote = Array.isArray(raw.work_format)
            ? raw.work_format.some(f => f.id === 'REMOTE')
            : raw.schedule?.id === 'remote';

        // Превращаем ссылку с HH на Zarplata
        let zpUrl = `https://zarplata.ru/vacancy/${raw.id}`;
        if (raw.alternate_url) {
            zpUrl = raw.alternate_url.replace('hh.ru', 'zarplata.ru');
        }

        return {
            externalId: String(raw.id),
            source: 'zarplata',
            url: zpUrl,
            title: raw.name,
            company: raw.employer?.name ?? null,
            description: [raw.snippet?.requirement, raw.snippet?.responsibility]
                            .filter(Boolean).join(' ') || null,
            salaryMin: raw.salary?.from ?? null,
            salaryMax: raw.salary?.to ?? null,
            salaryCurrency: raw.salary?.currency ?? 'RUB',
            location: raw.address?.city ?? raw.area?.name ?? null,
            remote,
            experience: EXPERIENCE_MAP[raw.experience?.id] ?? null,
            employment: raw.employment_form?.id === 'FULL' ? 'full' : null,
            stack: [stackText],
            publishedAt: raw.published_at ? new Date(raw.published_at) : new Date(),
            raw,
        };
    }
}
