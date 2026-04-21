import { BaseParser } from './baseParser.js';

const STACKS_TO_PARSE = ['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'React', 'Node.js'];

export class HhParser extends BaseParser {
    constructor() {
        super('hh');
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://hh.ru/'
        };
    }

    async fetchJobs() {
        const allJobs = [];

        for (const stack of STACKS_TO_PARSE) {
            console.log(`[HhParser] Fetching stack: ${stack}`);
            try {
                const jobs = await this.#scrapeByStack(stack);
                allJobs.push(...jobs);
                
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
            } catch (error) {
                console.error(`[HhParser] Error for stack ${stack}:`, error.message);
            }
        }

        if (allJobs.length > 0) {
            await this.saveJobs(allJobs);
        }
        return allJobs;
    }

    async #scrapeByStack(stackText) {
        const url = `https://hh.ru/search/vacancy?text=${encodeURIComponent(stackText + ' junior')}&area=113&order_by=publication_time&items_on_page=50`;

        const response = await fetch(url, { headers: this.headers });
        if (!response.ok) throw new Error(`HH HTTP Error: ${response.status}`);

        const html = await response.text();
        const jobs = [];

        const entryRegex = /data-qa="vacancy-serp__vacancy"([\s\S]*?)<div class="serp-item__footer"/g;
        
        let match;
        while ((match = entryRegex.exec(html)) !== null) {
            const block = match[1];

            // Извлекаем ID
            const idMatch = block.match(/data-item-id="(\d+)"/);
            // Извлекаем URL и Title
            const linkMatch = block.match(/data-qa="serp-item__title" [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
            // Извлекаем Компанию
            const companyMatch = block.match(/data-qa="vacancy-serp__vacancy-employer"[^>]*>([\s\S]*?)<\/a>/);
            // Извлекаем Город
            const areaMatch = block.match(/data-qa="vacancy-serp__vacancy-address"[^>]*>([\s\S]*?)<\/span>/);

            if (idMatch && linkMatch) {
                jobs.push({
                    externalId: idMatch[1],
                    source: 'hh',
                    url: linkMatch[1].split('?')[0],
                    title: this.#cleanHtml(linkMatch[2]),
                    company: companyMatch ? this.#cleanHtml(companyMatch[1]) : 'Не указано',
                    location: areaMatch ? this.#cleanHtml(areaMatch[1]) : 'Не указано',
                    remote: block.includes('Удаленная работа') || block.includes('можно из дома'),
                    experience: 'no_experience',
                    stack: [stackText],
                    publishedAt: new Date()
                });
            }
        }

        console.log(`[HhParser] Extracted ${jobs.length} jobs for ${stackText}`);
        return jobs;
    }

    #cleanHtml(html) {
        return html
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            .trim();
    }
}