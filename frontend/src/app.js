// Точка входа фронтенда.
// Инициализация компонентов: SearchBar, JobList.
// Навешивание глобальных обработчиков событий.

import { fetchJobs, addFavorite, removeFavorite, fetchFavorites } from './api/client.js';
import { renderJobs } from './components/JobList.js';
import { initSearchBar } from './components/SearchBar.js';
// В будущем тут будет import { parseQuery } from './utils/queryParser.js';

let currentJobs = [];
let favoriteIds = new Set();

async function loadFavorites() {
    try {
        const data = await fetchFavorites();
        favoriteIds = new Set(data.jobs.map(j => j.id));
    } catch (err) {
        console.error('Ошибка загрузки избранного:', err);
    }
}

async function handleSearch(rawQuery) {
    // Пока queryParser не реализован (Этап 3), передаем просто как текстовый поиск
    // В будущем: const params = parseQuery(rawQuery);
    const params = { q: rawQuery }; 
    
    try {
        const data = await fetchJobs(params);
        currentJobs = data.jobs;
        renderJobs(currentJobs, favoriteIds, handleToggleFavorite);
    } catch (err) {
        console.error('Ошибка поиска:', err);
        document.getElementById('jobs-list').innerHTML = '<div class="error">Не удалось загрузить вакансии</div>';
    }
}

async function handleToggleFavorite(jobId, isAdding, btnElement) {
    try {
        if (isAdding) {
            await addFavorite(jobId);
            favoriteIds.add(jobId);
            btnElement.classList.add('active');
            btnElement.textContent = '★ В избранном';
        } else {
            await removeFavorite(jobId);
            favoriteIds.delete(jobId);
            btnElement.classList.remove('active');
            btnElement.textContent = '☆ Сохранить';
        }
    } catch (err) {
        console.error('Ошибка изменения избранного:', err);
        alert('Не удалось изменить статус избранного');
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    initSearchBar(handleSearch);
    
    await loadFavorites(); // Сначала грузим id избранных
    await handleSearch(''); // Потом грузим дефолтный список вакансий
});