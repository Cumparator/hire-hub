// frontend/src/api/client.js
import { MOCK_JOBS } from './mockData.js';

// Имитация БД для избранного (храним просто в памяти, сбросится при обновлении страницы)
const mockFavorites = new Set();

// Утилита для имитации задержки сети (500мс)
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchJobs(params = {}) {
    await delay(); // Имитируем запрос
    
    let filteredJobs = [...MOCK_JOBS];

    // Простейшая локальная фильтрация для тестов поиска
    if (params.q) {
        const query = params.q.toLowerCase();
        filteredJobs = filteredJobs.filter(job => 
            job.title.toLowerCase().includes(query) || 
            job.stack.some(tech => tech.toLowerCase().includes(query))
        );
    }

    return { 
        jobs: filteredJobs, 
        pagination: { page: 1, perPage: 20, total: filteredJobs.length, totalPages: 1 } 
    };
}

export async function fetchFavorites() {
    await delay(300);
    const jobs = MOCK_JOBS.filter(job => mockFavorites.has(job.id));
    return { jobs };
}

export async function addFavorite(jobId) {
    await delay(200);
    mockFavorites.add(jobId);
    return { favoriteId: crypto.randomUUID() };
}

export async function removeFavorite(jobId) {
    await delay(200);
    mockFavorites.delete(jobId);
    return null; // 204 No Content
}