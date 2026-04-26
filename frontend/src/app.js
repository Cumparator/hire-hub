// frontend/src/app.js

import { fetchJobs, addFavorite, removeFavorite, fetchFavorites } from './api/client.js';
import { renderJobs } from './components/JobList.js';
import { initSearchBar } from './components/SearchBar.js';
import { initFilterPanel } from './components/FilterPanel.js';

let currentJobs = [];
let favoriteIds = new Set();

// Текущие параметры от каждого источника — мержим перед запросом
let searchParams = {};
let filterParams = {};

async function loadFavorites() {
    try {
        const data = await fetchFavorites();
        favoriteIds = new Set(data.jobs.map(j => j.id));
    } catch (err) {
        console.error('Ошибка загрузки избранного:', err);
    }
}

async function doSearch() {
    const params = { ...filterParams, ...searchParams };
    const listEl = document.getElementById('jobs-list');
    try {
        const data = await fetchJobs(params);
        currentJobs = data.jobs;
        renderJobs(currentJobs, favoriteIds, handleToggleFavorite);

        // Если бэкенд запустил фоновый парсинг — показываем баннер
        if (data.refreshing) {
            showRefreshingBanner(listEl, params);
        }
    } catch (err) {
        console.error('Ошибка поиска:', err);
        listEl.innerHTML = '<div class="error">Ошибка: ' + err.message + '</div>';
    }
}

// Показывает баннер "обновляем" и через N секунд перезапрашивает список
function showRefreshingBanner(listEl, params) {
    // Убираем старый баннер если есть
    listEl.querySelector('.refreshing-banner')?.remove();

    const banner = document.createElement('div');
    banner.className = 'refreshing-banner';
    banner.innerHTML = `
        <span class="refreshing-banner__dot"></span>
        Ищем свежие вакансии по фильтру, обновим через несколько секунд...
    `;
    listEl.prepend(banner);

    // Повторный запрос через 5 секунд
    setTimeout(async () => {
        banner.remove();
        const merged = { ...filterParams, ...searchParams };
        // Проверяем что фильтры не изменились пока ждали
        const stillSame = JSON.stringify(merged) === JSON.stringify(params);
        if (stillSame) await doSearch();
    }, 5000);
}

// Вызывается из SearchBar (уже разобранные params)
function handleSearch(params) {
    searchParams = params;
    doSearch();
}

// Вызывается из FilterPanel
function handleFilter(params) {
    filterParams = params;
    doSearch();
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

document.addEventListener('DOMContentLoaded', async () => {
    initSearchBar(handleSearch);
    initFilterPanel(handleFilter);
    initTabs();

    await loadFavorites();
    await doSearch();
});

let currentTab = 'all';

function initTabs() {
    const tabAll = document.getElementById('tab-all');
    const tabFav = document.getElementById('tab-fav');

    tabAll.addEventListener('click', () => {
        currentTab = 'all';
        tabAll.classList.add('active');
        tabFav.classList.remove('active');
        document.getElementById('search-container').classList.remove('hidden');
        document.getElementById('filters-inline').classList.remove('hidden');
        renderJobs(currentJobs, favoriteIds, handleToggleFavorite);
    });

    tabFav.addEventListener('click', async () => {
        currentTab = 'favorites';
        tabFav.classList.add('active');
        tabAll.classList.remove('active');
        document.getElementById('search-container').classList.add('hidden');
        document.getElementById('filters-inline').classList.add('hidden');
        try {
            const data = await fetchFavorites();
            renderJobs(data.jobs, favoriteIds, handleToggleFavorite);
        } catch (err) {
            console.error('Ошибка загрузки избранного', err);
        }
    });
}