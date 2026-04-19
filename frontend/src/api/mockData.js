// frontend/src/api/mockData.js

export const MOCK_JOBS = [
    {
        id: '1a2b3c-hh',
        source: 'hh',
        url: 'https://hh.ru/vacancy/1',
        title: 'Junior Frontend Developer',
        company: 'Яндекс',
        salaryMin: 80000,
        salaryMax: 120000,
        salaryCurrency: 'RUB',
        location: 'Москва',
        remote: false,
        experience: 'no_experience',
        stack: ['JavaScript', 'React', 'TypeScript'],
        publishedAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
        id: '4d5e6f-tg',
        source: 'tg',
        url: 'https://t.me/junior_jobs_it/123',
        title: 'Стажер Python (Backend)',
        company: null, // В ТГ часто не указывают
        salaryMin: 60000,
        salaryMax: null,
        salaryCurrency: 'RUB',
        location: 'Санкт-Петербург',
        remote: true,
        experience: 'intern',
        stack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
        publishedAt: new Date(Date.now() - 86400000).toISOString() // день назад
    },
    {
        id: '7g8h9i-hh',
        source: 'hh',
        url: 'https://hh.ru/vacancy/3',
        title: 'Go Developer (Junior+)',
        company: 'Авито',
        salaryMin: null, // ЗП не указана
        salaryMax: null,
        salaryCurrency: 'RUB',
        location: 'Удалённо',
        remote: true,
        experience: 'between1And3',
        stack: ['Go', 'PostgreSQL', 'Kafka'],
        publishedAt: new Date().toISOString()
    }
];