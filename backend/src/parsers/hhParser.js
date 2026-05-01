import { BaseParser } from './baseParser.js';
import jobsService from '../services/jobsService.js';

const HH_API  = 'https://api.hh.ru';
const HH_AUTH = 'https://hh.ru/oauth/token';
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

export class HhParser extends BaseParser {
    constructor() {
        super('hh');
        this.scrapeHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
            'Referer': 'https://hh.ru/',
        };
    }

    // ── Точка входа ──────────────────────────────────────────────────────────

    async fetchJobs(filters = {}) {
        const useApi = !!process.env.HH_TOKEN;
        console.log(`[HhParser] Режим: ${useApi ? "API (token из env)" : "scraper (fallback)"}`);

        const allJobs = [];
        const searchTargets = this.#buildSearchTargets(filters);

        for (const target of searchTargets) {
            const stack = target.stack;
            const existingCount = await jobsService.countJobsByStack(stack, 'hh');

            if (existingCount >= MIN_JOBS_PER_STACK) {
                console.log(`[HhParser] Skipping ${stack}: already have ${existingCount} jobs`);
                continue;
            }

            console.log(`[HhParser] Parsing ${stack}: only ${existingCount} in DB...`);

            try {
                const jobs = useApi
                    ? await this.#fetchByApi(target, filters)
                    : await this.#fetchByScraper(target, filters);

                if (jobs.length > 0) {
                    await this.saveJobs(jobs);
                    allJobs.push(...jobs);
                    console.log(`[HhParser] ${stack}: saved ${jobs.length} jobs`);
                } else {
                    console.log(`[HhParser] ${stack}: 0 jobs`);
                }
            } catch (err) {
                console.error(`[HhParser] ${stack}: ошибка —`, err.message);
                // Если API упал — пробуем скрейпер
                if (useApi) {
                    console.log(`[HhParser] ${stack}: пробуем scraper как fallback...`);
                    try {
                        const jobs = await this.#fetchByScraper(stack);
                        if (jobs.length > 0) {
                            await this.saveJobs(jobs);
                            allJobs.push(...jobs);
                            console.log(`[HhParser] ${stack}: scraper saved ${jobs.length} jobs`);
                        }
                    } catch (scrapeErr) {
                        console.error(`[HhParser] ${stack}: scraper тоже упал —`, scrapeErr.message);
                    }
                }
            }

            await new Promise(r => setTimeout(r, 500));
        }

        return allJobs;
    }

    #buildSearchTargets(filters) {
        const stacks = Array.isArray(filters.stacks) && filters.stacks.length
            ? filters.stacks
            : FULL_STACK_LIST;
        const query = filters.query?.trim();

        return stacks.map((stack) => ({
            stack,
            text: query ? `${query} ${stack}`.trim() : stack,
        }));
    }

    // ── OAuth API ────────────────────────────────────────────────────────────

    async #apiFetch(path, params = {}) {
        const token = process.env.HH_TOKEN;
        if (!token) throw new Error('HH_TOKEN не задан в env');
        const qs = new URLSearchParams(params);

        const resp = await fetch(`${HH_API}${path}?${qs}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'HH-User-Agent': APP_NAME,
                'User-Agent':    APP_NAME,
                'Accept':        'application/json',
            },
        });

        if (!resp.ok) throw new Error(`HH API ${resp.status} ${path}: ${(await resp.text()).slice(0, 200)}`);
        return resp.json();
    }

    async #fetchByApi(target, filters) {
        const jobs = [];
        let page = 0;
        let pages = 1;

        while (page < pages && page < 20) {
            const data = await this.#apiFetch('/vacancies', {
                text:     target.text,
                area:     '113',
                per_page: '100',
                page:     String(page),
                order_by: 'publication_time',
                ...(filters.schedule ? { schedule: filters.schedule } : {}),
                ...(filters.experience ? { experience: REVERSE_EXPERIENCE_MAP[filters.experience] ?? filters.experience } : {}),
            });

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
        // remote: work_format содержит {id: "REMOTE"} — новый формат HH API
        const remote = Array.isArray(raw.work_format)
            ? raw.work_format.some(f => f.id === 'REMOTE')
            : raw.schedule?.id === 'remote';

        return {
            externalId:     String(raw.id),
            source:         'hh',
            url:            raw.alternate_url,
            title:          raw.name,
            company:        raw.employer?.name ?? null,
            description:    [raw.snippet?.requirement, raw.snippet?.responsibility]
                                .filter(Boolean).join(' ') || null,
            salaryMin:      raw.salary?.from     ?? null,
            salaryMax:      raw.salary?.to       ?? null,
            salaryCurrency: raw.salary?.currency ?? 'RUB',
            location:       raw.address?.city ?? raw.area?.name ?? null,
            remote,
            experience:     EXPERIENCE_MAP[raw.experience?.id] ?? null,
            employment:     raw.employment_form?.id === 'FULL' ? 'full' : null,
            stack:          [stackText],
            publishedAt:    raw.published_at ? new Date(raw.published_at) : new Date(),
            raw,
        };
    }

    // ── Scraper fallback ─────────────────────────────────────────────────────

    async #fetchByScraper(target) {
        const url = `https://hh.ru/search/vacancy?text=${encodeURIComponent(target.text)}&area=113&order_by=publication_time&items_on_page=50`;
        const response = await fetch(url, { headers: this.scrapeHeaders });
        if (!response.ok) throw new Error(`Scraper status ${response.status}`);
        return this.#parseHtml(await response.text(), target.stack);
    }

    #parseHtml(html, stackText) {
        const jobs = [];
        const blockRe = /<div id="(\d{6,12})" class="vacancy-card[^"]*">([\s\S]*?)(?=<div id="\d{6,12}" class="vacancy-card|<div class="pager)/g;
        let match;

        while ((match = blockRe.exec(html)) !== null) {
            const [, vacancyId, block] = match;
            const title = this.#extractDataQa(block, 'serp-item__title-text');
            if (!title) continue;

            const { salaryMin, salaryMax } = this.#extractSalary(block);

            jobs.push({
                externalId:     vacancyId,
                source:         'hh',
                url:            `https://hh.ru/vacancy/${vacancyId}`,
                title,
                company:        this.#extractDataQa(block, 'vacancy-serp__vacancy-employer-text'),
                description:    null,
                salaryMin,
                salaryMax,
                salaryCurrency: 'RUB',
                location:       this.#extractDataQa(block, 'vacancy-serp__vacancy-address'),
                remote:         /удалённо|удаленно|remote/i.test(block),
                experience:     this.#mapExperience(block.match(/data-qa="vacancy-serp__vacancy-work-experience-([^"]+)"/)?.[1]),
                employment:     null,
                stack:          [stackText],
                publishedAt:    this.#extractDateScraper(block),
                raw:            { vacancyId, stackText, _source: 'scraper' },
            });
        }

        return jobs;
    }

    #extractDataQa(html, name) {
        const m = html.match(new RegExp(`data-qa="${name}"[^>]*>([^<]{1,200})`));
        return m ? m[1].replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim() : null;
    }

    #extractSalary(block) {
        const clean = block.replace(/<[^>]+>/g, '').replace(/\s|&nbsp;|\u202F/g, '');
        const range = clean.match(/(\d{4,9})(?:–|-)(\d{4,9})[₽р]/i);
        if (range) return { salaryMin: +range[1], salaryMax: +range[2] };
        const from = clean.match(/от(\d{4,9})[₽р]/i);
        if (from) return { salaryMin: +from[1], salaryMax: null };
        const to = clean.match(/до(\d{4,9})[₽р]/i);
        if (to) return { salaryMin: null, salaryMax: +to[1] };
        return { salaryMin: null, salaryMax: null };
    }

    #mapExperience(hhKey) {
        return EXPERIENCE_MAP[hhKey] ?? null;
    }

    #extractDateScraper(block) {
        // <time datetime="2026-04-21T10:00:00+0300">
        const m = block.match(/datetime="([\d\-T:+]+)"/);
        if (m) {
            const d = new Date(m[1]);
            if (!isNaN(d)) return d;
        }
        return new Date();
    }
}
