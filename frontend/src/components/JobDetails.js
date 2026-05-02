import { fetchJobById, trackJobClick } from '../api/client.js';

export async function renderJobDetails(jobId, favoriteIds, onToggleFavorite, { currentUser, openAuthModal } = {}) {
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

        let finalDescription = 'Описание отсутствует.';
        if (job.description) {
            if (job.description.includes('<') && job.description.includes('>')) {
                finalDescription = job.description;
            } else {
                finalDescription = job.description.replace(/</g, '&lt;').replace(/\n/g, '<br>');
            }
        }

        // Строим шапку: кнопка назад + кнопка входа если не авторизован
        const authButtonHtml = currentUser
            ? `<span class="details-user-name">${currentUser.login}</span>`
            : `<button class="details-login-btn" id="details-btn-login">Войти / Зарегистрироваться</button>`;

        container.innerHTML = `
            <div class="details-topbar">
                <button id="back-btn" class="back-btn">← Назад к поиску</button>
                <div class="details-topbar__auth">${authButtonHtml}</div>
            </div>

            <div class="job-details">
                <div class="job-details__header">
                    <div>
                        <h1 class="job-details__title">
                            <a href="${job.url}" class="original-url-link" target="_blank" rel="noopener noreferrer">${job.title} ↗</a>
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
                    ${finalDescription}
                </div>
            </div>
        `;

        // ── Кнопка входа в шапке детальной страницы ──────────────────────────
        const detailsLoginBtn = container.querySelector('#details-btn-login');
        if (detailsLoginBtn && openAuthModal) {
            detailsLoginBtn.addEventListener('click', () => openAuthModal());
        }

        // ── Перехват клика по ссылке на оригинал ──────────────────────────────
        const originalLink = container.querySelector('.original-url-link');
        originalLink.addEventListener('click', (e) => {
            if (!currentUser) {
                e.preventDefault();
                if (openAuthModal) {
                    openAuthModal(job.url, 'Войдите, чтобы перейти к оригиналу вакансии');
                }
            } else {
                trackJobClick(job.id);
            }
        });

        // Обработчик для кнопки "Назад"
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.hash = '';
        });

        // Обработчик для избранного
        const favBtn = container.querySelector('.details-fav-btn');
        favBtn.addEventListener('click', async (e) => {
            const btn = e.target;
            const id = btn.dataset.id;
            const currentlyFav = btn.classList.contains('active');
            await onToggleFavorite(id, !currentlyFav, btn);
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