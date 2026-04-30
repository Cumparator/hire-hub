// frontend/src/app.js

import { fetchJobs, addFavorite, removeFavorite, fetchFavorites } from './api/client.js';
import { renderJobs } from './components/JobList.js';
import { initSearchBar } from './components/SearchBar.js';
import { initFilterPanel } from './components/FilterPanel.js';
import { renderJobDetails } from './components/JobDetails.js';

let currentJobs = [];
let favoriteIds = new Set();
let currentPage = 1;
let currentPagination = null;
const JOBS_PER_PAGE = 20;
const REFRESH_POLL_INTERVAL_MS = 5000;

// Текущие параметры от каждого источника — мержим перед запросом
let searchParams = {};
let filterParams = {};
let refreshTimerId = null;

function buildRequestParams() {
    return {
        ...filterParams,
        ...searchParams,
        page: currentPage,
        per_page: JOBS_PER_PAGE,
    };
}

async function loadFavorites() {
    try {
        const data = await fetchFavorites();
        favoriteIds = new Set(data.jobs.map(j => j.id));
    } catch (err) {
        console.error('Ошибка загрузки избранного:', err);
    }
}

async function doSearch() {
    const params = buildRequestParams();
    const requestKey = JSON.stringify(params);
    const listEl = document.getElementById('jobs-list');
    try {
        const data = await fetchJobs(params);
        if (requestKey !== JSON.stringify(buildRequestParams()) || currentTab !== 'all') {
            return;
        }

        currentJobs = data.jobs;
        currentPagination = data.pagination ?? null;
        renderJobs(currentJobs, favoriteIds, handleToggleFavorite);
        renderServerPagination();

        if (data.refreshing) {
            renderRefreshingBanner(listEl);
            scheduleRefreshPolling(requestKey);
        } else {
            stopRefreshPolling();
        }
    } catch (err) {
        stopRefreshPolling();
        console.error('Ошибка поиска:', err);
        listEl.innerHTML = '<div class="error">Ошибка: ' + err.message + '</div>';
    }
}

function renderRefreshingBanner(listEl) {
    listEl.querySelector('.refreshing-banner')?.remove();

    const banner = document.createElement('div');
    banner.className = 'refreshing-banner';
    banner.innerHTML = `
        <span class="refreshing-banner__dot"></span>
        Ищем свежие вакансии по фильтру, обновим через несколько секунд...
    `;
    listEl.prepend(banner);
}

function scheduleRefreshPolling(requestKey) {
    clearTimeout(refreshTimerId);
    refreshTimerId = setTimeout(async () => {
        if (currentTab !== 'all') return;
        if (requestKey !== JSON.stringify(buildRequestParams())) return;
        await doSearch();
    }, REFRESH_POLL_INTERVAL_MS);
}

function stopRefreshPolling() {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
    document.querySelector('#jobs-list .refreshing-banner')?.remove();
}

// Вызывается из SearchBar (уже разобранные params)
function handleSearch(params) {
    stopRefreshPolling();
    searchParams = params;
    currentPage = 1;
    doSearch();
}

// Вызывается из FilterPanel
function handleFilter(params) {
    stopRefreshPolling();
    filterParams = params;
    currentPage = 1;
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
        stopRefreshPolling();
        currentTab = 'all';
        tabAll.classList.add('active');
        tabFav.classList.remove('active');
        document.getElementById('search-container').classList.remove('hidden');
        document.getElementById('filters-inline').classList.remove('hidden');
        renderJobs(currentJobs, favoriteIds, handleToggleFavorite);
        renderServerPagination();
        if (currentJobs.length === 0) {
            doSearch();
        }
    });

    tabFav.addEventListener('click', async () => {
        stopRefreshPolling();
        currentTab = 'favorites';
        tabFav.classList.add('active');
        tabAll.classList.remove('active');
        document.getElementById('search-container').classList.add('hidden');
        document.getElementById('filters-inline').classList.add('hidden');
        try {
            const data = await fetchFavorites();
            renderFavoritePage(data.jobs);
        } catch (err) {
            console.error('Ошибка загрузки избранного', err);
        }
    });
}

function renderServerPagination() {
    renderPagination(currentPagination, (page) => {
        currentPage = page;
        doSearch();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function renderFavoritePage(favoriteJobs) {
    const total = favoriteJobs.length;
    const totalPages = Math.ceil(total / JOBS_PER_PAGE);
    const safePage = Math.min(currentPage, Math.max(totalPages, 1));
    const start = (safePage - 1) * JOBS_PER_PAGE;
    const jobsOnPage = favoriteJobs.slice(start, start + JOBS_PER_PAGE);

    currentPage = safePage;
    renderJobs(jobsOnPage, favoriteIds, handleToggleFavorite);
    renderPagination(
        {
            page: safePage,
            perPage: JOBS_PER_PAGE,
            total,
            totalPages,
        },
        async (page) => {
            currentPage = page;
            const data = await fetchFavorites();
            renderFavoritePage(data.jobs);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    );
}

function renderPagination(pagination, onPageChange) {
    const container = document.getElementById('pagination');
    if (!container) return;

    if (!pagination || pagination.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const { page, perPage, total, totalPages } = pagination;
    const start = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);
    const pages = buildPageItems(page, totalPages);

    container.innerHTML = `
        <div class="pagination">
            <div class="pagination__summary">Показано ${start}-${end} из ${total}</div>
            <div class="pagination__controls">
                <button class="pagination__nav" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Назад</button>
                ${pages.map((item) => item === '...'
                    ? '<span class="pagination__ellipsis">...</span>'
                    : `<button class="pagination__page ${item === page ? 'is-active' : ''}" data-page="${item}">${item}</button>`
                ).join('')}
                <button class="pagination__nav" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Дальше</button>
            </div>
        </div>
    `;

    container.querySelectorAll('button[data-page]').forEach((button) => {
        button.addEventListener('click', () => {
            const nextPage = Number(button.dataset.page);
            if (!nextPage || nextPage === page || nextPage < 1 || nextPage > totalPages) return;
            onPageChange(nextPage);
        });
    });
}

function buildPageItems(current, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);

    if (start > 2) items.push('...');
    for (let page = start; page <= end; page += 1) {
        items.push(page);
    }
    if (end < totalPages - 1) items.push('...');

    items.push(totalPages);
    return items;
}

async function handleRoute() {
    const hash = window.location.hash;
    const listView = document.getElementById('list-view');
    const detailsView = document.getElementById('details-view');
    const sidebar = document.getElementById('filters-sidebar');

    if (hash.startsWith('#job/')) {
        const jobId = hash.replace('#job/', '');
        
        listView.classList.add('hidden');
        if(sidebar) sidebar.classList.add('hidden');
        detailsView.classList.remove('hidden');
        
        await renderJobDetails(jobId, window.favoriteIds || new Set(), toggleFavoriteHandler);
    } else {
        detailsView.classList.add('hidden');
        detailsView.innerHTML = '';
        listView.classList.remove('hidden');
        if(sidebar) sidebar.classList.remove('hidden');
    }
}

window.addEventListener('hashchange', handleRoute);

handleRoute();