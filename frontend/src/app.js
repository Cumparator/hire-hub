// frontend/src/app.js

import {
  fetchJobs,
  addFavorite,
  removeFavorite,
  fetchFavorites,
  fetchCurrentUser,
  authLogout,
  trackEvent,
} from './api/client.js';
import { renderJobs } from './components/JobList.js';
import { initSearchBar } from './components/SearchBar.js';
import { initFilterPanel } from './components/FilterPanel.js';
import { AuthModal } from './components/AuthModal.js';

// ── Глобальное состояние ──────────────────────────────────────────────────────

let currentUser  = null;
let currentJobs  = [];
let favoriteIds  = new Set();
let currentPage  = 1;
let currentPagination = null;
let currentTab   = 'all';
let searchParams = {};
let filterParams = {};
let refreshTimerId = null;

const JOBS_PER_PAGE         = 20;
const REFRESH_POLL_INTERVAL = 5000;

// ── AuthModal ─────────────────────────────────────────────────────────────────

let authModal;

function openAuthModal(pendingJobUrl = null) {
  authModal.open(pendingJobUrl);
}

async function handleAuthSuccess(user) {
  currentUser = user;
  renderUserMenu();
  trackEvent('site_entry');
  await loadFavorites(); // добавить эту строку
  renderJobList(currentJobs); // перерендерить карточки
}
// ── Меню пользователя ─────────────────────────────────────────────────────────

function renderUserMenu() {
  let menuEl = document.getElementById('user-menu');
  if (!menuEl) {
    menuEl = document.createElement('div');
    menuEl.id = 'user-menu';
    menuEl.className = 'user-menu';
    document.getElementById('tabs-container')?.after(menuEl);
  }

  if (currentUser) {
    menuEl.innerHTML = `
      <span class="user-menu__name">${currentUser.login}</span>
      <button class="user-menu__logout" id="btn-logout">Выйти</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      await authLogout();
      currentUser = null;
      favoriteIds = new Set();
      renderUserMenu();
      renderJobList(currentJobs);
      doSearch();
    });
  } else {
    menuEl.innerHTML = `
      <button class="user-menu__login" id="btn-login">Войти / Зарегистрироваться</button>
    `;
    document.getElementById('btn-login')?.addEventListener('click', () => openAuthModal());
  }
}

// ── Вспомогательные ───────────────────────────────────────────────────────────

function buildRequestParams() {
  return { ...filterParams, ...searchParams, page: currentPage, per_page: JOBS_PER_PAGE };
}

async function loadFavorites() {
  try {
    const data = await fetchFavorites();
    favoriteIds = new Set(data.jobs.map(j => j.id));
  } catch { /* anon пользователь */ }
}

// ── Поиск ─────────────────────────────────────────────────────────────────────

async function doSearch() {
  const params     = buildRequestParams();
  const requestKey = JSON.stringify(params);
  const listEl     = document.getElementById('jobs-list');

  try {
    const data = await fetchJobs(params);
    if (requestKey !== JSON.stringify(buildRequestParams()) || currentTab !== 'all') return;

    currentJobs       = data.jobs;
    currentPagination = data.pagination ?? null;
    renderJobList(currentJobs);
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
    listEl.innerHTML = `<div class="error">Ошибка: ${err.message}</div>`;
  }
}

function renderJobList(jobs) {
  renderJobs(jobs, favoriteIds, handleToggleFavorite, { currentUser, openAuthModal });
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
  }, REFRESH_POLL_INTERVAL);
}

function stopRefreshPolling() {
  clearTimeout(refreshTimerId);
  refreshTimerId = null;
  document.querySelector('#jobs-list .refreshing-banner')?.remove();
}

function handleSearch(params) {
  stopRefreshPolling();
  searchParams = params;
  currentPage = 1;
  doSearch();
}

function handleFilter(params) {
  stopRefreshPolling();
  filterParams = params;
  currentPage  = 1;
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

// ── Табы ──────────────────────────────────────────────────────────────────────

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
    renderJobList(currentJobs);
    renderServerPagination();
    if (currentJobs.length === 0) doSearch();
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

// ── Страница избранного ───────────────────────────────────────────────────────

function renderFavoritePage(favoriteJobs) {
  const total      = favoriteJobs.length;
  const totalPages = Math.ceil(total / JOBS_PER_PAGE);
  const safePage   = Math.min(currentPage, Math.max(totalPages, 1));
  const start      = (safePage - 1) * JOBS_PER_PAGE;
  const jobsOnPage = favoriteJobs.slice(start, start + JOBS_PER_PAGE);

  currentPage = safePage;
  renderJobs(jobsOnPage, favoriteIds, handleToggleFavorite, { currentUser, openAuthModal });
  renderPagination(
    { page: safePage, perPage: JOBS_PER_PAGE, total, totalPages },
    async (page) => {
      currentPage = page;
      const data  = await fetchFavorites();
      renderFavoritePage(data.jobs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  );
}

// ── Пагинация ─────────────────────────────────────────────────────────────────

function renderServerPagination() {
  renderPagination(currentPagination, (page) => {
    currentPage = page;
    doSearch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
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
  const end   = Math.min(page * perPage, total);
  const pages = buildPageItems(page, totalPages);

  container.innerHTML = `
    <div class="pagination">
      <div class="pagination__summary">Показано ${start}–${end} из ${total}</div>
      <div class="pagination__controls">
        <button class="pagination__nav" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Назад</button>
        ${pages.map(item => item === '...'
          ? '<span class="pagination__ellipsis">...</span>'
          : `<button class="pagination__page ${item === page ? 'is-active' : ''}" data-page="${item}">${item}</button>`
        ).join('')}
        <button class="pagination__nav" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Дальше</button>
      </div>
    </div>
  `;

  container.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = Number(btn.dataset.page);
      if (!next || next === page || next < 1 || next > totalPages) return;
      onPageChange(next);
    });
  });
}

function buildPageItems(current, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const items = [1];
  const start = Math.max(2, current - 1);
  const end   = Math.min(totalPages - 1, current + 1);
  if (start > 2) items.push('...');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push('...');
  items.push(totalPages);
  return items;
}

// ── Аналитика при уходе ───────────────────────────────────────────────────────

function initLeaveTracking() {
  window.addEventListener('beforeunload', () => {
    if (!currentUser) return;
    // sendBeacon гарантирует отправку при закрытии вкладки
    const body = JSON.stringify({ eventType: 'site_leave' });
    navigator.sendBeacon(`${import.meta.env.VITE_API_URL ?? ''}/api/analytics/event`, new Blob([body], { type: 'application/json' }));
  });
}

// ── Старт ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // AuthModal создаём сразу — он вставляет себя в body
  authModal = new AuthModal({ onSuccess: handleAuthSuccess });

  initSearchBar(handleSearch);
  initFilterPanel(handleFilter);
  initTabs();
  initLeaveTracking();

  // Восстанавливаем сессию
  const meData = await fetchCurrentUser();
  if (meData?.user) {
    currentUser = meData.user;
    trackEvent('site_entry');
  }
  renderUserMenu();

  await loadFavorites();
  await doSearch();
});
