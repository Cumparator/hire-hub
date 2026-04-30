import { fetchJobById } from '../api/client.js';

export async function renderJobDetails(jobId, favoriteIds, onToggleFavorite) {
    const container = document.getElementById('details-view');
    if (!container) return;

    container.innerHTML = '<div class="loading">Загрузка вакансии...</div>';

    try {
        const job = await fetchJobById(jobId);
        const isFav = favoriteIds.has(job.id);
        
        // Рендерим теги стека
        const stackHtml = (job.stack || []).map(tech => `<span class="tech-tag">${tech}</span>`).join('');
        
        // Форматируем ЗП
        let salaryText = 'Зарплата не указана';
        if (job.salaryMin && job.salaryMax) salaryText = `от ${job.salaryMin} до ${job.salaryMax} ${job.salaryCurrency}`;
        else if (job.salaryMin) salaryText = `от ${job.salaryMin} ${job.salaryCurrency}`;
        else if (job.salaryMax) salaryText = `до ${job.salaryMax} ${job.salaryCurrency}`;

        // Защита от XSS и переносы строк для описания
        const safeDescription = job.description 
            ? job.description.replace(/</g, '&lt;').replace(/\n/g, '<br>')
            : 'Описание отсутствует.';

        container.innerHTML = `
            <div class="job-details">
                <button id="back-btn" class="back-btn">← Назад к поиску</button>
                
                <div class="job-details__header">
                    <div>
                        <h1 class="job-details__title">
                            <a href="${job.url}" target="_blank">${job.title} ↗</a>
                        </h1>
                        <div class="job-details__meta">
                            ${job.company ? `<span>🏢 ${job.company}</span>` : ''}
                            <span>📍 ${job.location || 'Не указана'}</span>
                            ${job.remote ? '<span class="tag-remote">Удалённо</span>' : ''}
                        </div>
                    </div>
                    <button class="job-card__fav-btn details-fav-btn ${isFav ? 'active' : ''}" data-id="${job.id}">
                        ${isFav ? '★ В избранном' : '☆ В избранное'}
                    </button>
                </div>

                <div class="job-details__salary">${salaryText}</div>
                
                ${stackHtml ? `<div class="job-details__stack">${stackHtml}</div>` : ''}
                
                <div class="job-details__body">
                    ${safeDescription}
                </div>
            </div>
        `;

        // Обработчик для кнопки "Назад" (просто очищаем хэш)
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.hash = '';
        });

        // Обработчик для избранного
        const favBtn = container.querySelector('.details-fav-btn');
        favBtn.addEventListener('click', async (e) => {
            const btn = e.target;
            const id = btn.dataset.id;
            const currentlyFav = btn.classList.contains('active');
            
            await onToggleFavorite(id, !currentlyFav);
            btn.classList.toggle('active');
            btn.innerText = !currentlyFav ? '★ В избранном' : '☆ В избранное';
        });

    } catch (err) {
        container.innerHTML = `
            <div class="job-details-error">
                <h2>Ошибка загрузки</h2>
                <p>${err.message}</p>
                <button id="back-btn" class="back-btn">← Назад</button>
            </div>
        `;
        document.getElementById('back-btn').addEventListener('click', () => window.location.hash = '');
    }
}