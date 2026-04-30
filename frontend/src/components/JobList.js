// Компонент рендера списка вакансий.
// Принимает массив данных, создает DOM-элементы карточек и аппендит их в #jobs-list.
import { createJobCard } from './JobCard.js';

export function renderJobs(jobsData) {
    const listContainer = document.getElementById('jobs-list');
    listContainer.innerHTML = '';

    if (!jobsData || jobsData.length === 0) {
        listContainer.innerHTML = '<p class="jobs-list__empty">Ничего не найдено</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    
    jobsData.forEach(job => {
        const card = createJobCard(job);
        fragment.appendChild(card);
    });

    listContainer.appendChild(fragment);
}