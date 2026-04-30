// Точка входа фронтенда.
// Инициализация компонентов: SearchBar, JobList.
// Навешивание глобальных обработчиков событий.
import { fetchJobs } from './api/client.js';
import { renderJobs } from './components/JobList.js';
import { renderJobDetail } from './components/JobDetail.js';
// ... инициализация

let isListLoaded = false; // Флаг для проверки кэша главной страницы

async function loadInitialJobs() {
    // В реальности тут будут браться фильтры из SearchBar
    const data = await fetchJobs();
    renderJobs(data.jobs);
    isListLoaded = true;
}

async function handleRouting() {
    const hash = window.location.hash;
    const mainContent = document.getElementById('main-content');
    const detailPage = document.getElementById('job-detail-page');

    if (hash.startsWith('#job/')) {
        // Показываем вакансию
        const jobId = hash.replace('#job/', '');
        mainContent.style.display = 'none';
        detailPage.style.display = 'block';
        await renderJobDetail(jobId);
    } else {
        // Показываем главную
        detailPage.style.display = 'none';
        mainContent.style.display = 'block';
        
        if (!isListLoaded) {
            await loadInitialJobs();
        }
    }
}

// Инициализация
function init() {
    window.addEventListener('hashchange', handleRouting);
    
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.hash = ''; // Возврат на главную
    });

    // Запускаем роутинг при старте
    handleRouting();
}

init();