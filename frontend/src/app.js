// Точка входа фронтенда.
// Инициализация компонентов: SearchBar, JobList.
// Навешивание глобальных обработчиков событий.

import { fetchJobs, addFavorite, removeFavorite, fetchFavorites } from './api/client.js';
import { renderJobs } from './components/JobList.js';
import { initSearchBar } from './components/SearchBar.js';

let currentJobs = [];
let favoriteIds = new Set(); // TODO: Надо бы уйти от глобальных переменных, это надо делать через контекст или стор, но в целом так тоже ок

async function loadFavorites() {
    try {
        const data = await fetchFavorites();
        favoriteIds = new Set(data.jobs.map(j => j.id));
    } catch (err) {
        console.error('Ошибка загрузки избранного:', err);
    }
}

// Принимает уже разобранный объект параметров от SearchBar → parseQuery → toApiParams
async function handleSearch(params = {}) {
    try {
        const data = await fetchJobs(params);
        currentJobs = data.jobs;
        renderJobs(currentJobs, favoriteIds, handleToggleFavorite);
    } catch (err) {
        console.error('Ошибка поиска:', err);
        document.getElementById('jobs-list').innerHTML = '<div class="error">Ошибка: ' + err.message + '<br><small>' + (err.stack || '') + '</small></div>';
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
    initTabs();
    
    await loadFavorites(); // Сначала грузим id избранных
    await handleSearch(''); // Потом грузим дефолтный список вакансий
});

let currentTab = 'all'; // 'all' | 'favorites'

// Функция инициализации табов
function initTabs() {
    const tabAll = document.getElementById('tab-all');
    const tabFav = document.getElementById('tab-fav');

    tabAll.addEventListener('click', () => {
        currentTab = 'all';
        tabAll.classList.add('active');
        tabFav.classList.remove('active');
        document.getElementById('search-container').style.display = 'block'; // Показываем поиск
        renderJobs(currentJobs, favoriteIds, handleToggleFavorite);
    });

    tabFav.addEventListener('click', async () => {
        currentTab = 'favorites';
        tabFav.classList.add('active');
        tabAll.classList.remove('active');
        document.getElementById('search-container').style.display = 'none'; // TODO: из js лучше не управлять стилями, а добавлять/удалять классы, и уже в CSS прописать, что .hidden { display: none }, а тут просто toggleClass('hidden')
        
        try {
            // Запрашиваем актуальное избранное (наши моки отработают)
            const data = await fetchFavorites();
            renderJobs(data.jobs, favoriteIds, handleToggleFavorite);
        } catch (err) {
            console.error('Ошибка загрузки избранного', err);
        }
    });
}
