// Компонент рендера списка вакансий.
// Принимает массив данных, создает DOM-элементы карточек и аппендит их в #jobs-list.

// frontend/src/components/JobList.js
import { createJobCard } from './JobCard.js';

export function renderJobs(jobsData, favoriteIds, onToggleFavorite) {
    const container = document.getElementById('jobs-list');
    if (!container) return;

    container.innerHTML = ''; // Очищаем контейнер перед новым рендером

    if (jobsData.length === 0) {
        container.innerHTML = '<div class="no-results">Вакансий не найдено</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    
    jobsData.forEach(job => {
        const isFav = favoriteIds.has(job.id);
        const cardNode = createJobCard(job, isFav, onToggleFavorite);
        fragment.appendChild(cardNode);
    });

    container.appendChild(fragment);
}