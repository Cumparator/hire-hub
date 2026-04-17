export class BaseParser {
    constructor(sourceName) {
        this.sourceName = sourceName;
    }

    async fetchJobs(filters) {
        throw new Error(`Метод fetchJobs() не реализован в парсере ${this.sourceName}`);
    }

    normalizeJob(rawJob) {
        throw new Error(`Метод normalizeJob() не реализован в парсере ${this.sourceName}`);
    }
}
