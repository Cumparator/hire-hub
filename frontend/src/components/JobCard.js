// Компонент одной карточки вакансии.
// Возвращает готовый DOM-узел (div) с заполненными данными (зарплата, стек, кнопка "В избранное").

export function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'job-card';

    let salaryText = 'Не указана';
    if (job.salaryMin && job.salaryMax) salaryText = `от ${job.salaryMin} до ${job.salaryMax} ${job.salaryCurrency}`;
    else if (job.salaryMin) salaryText = `от ${job.salaryMin} ${job.salaryCurrency}`;
    else if (job.salaryMax) salaryText = `до ${job.salaryMax} ${job.salaryCurrency}`;

    const stackTags = (job.stack || []).map(t => `<span class="job-card__tag">${t}</span>`).join('');

    card.innerHTML = `
        <div class="job-card__header">
            <h3 class="job-card__title">${job.title}</h3>
            <button class="job-card__favorite-btn" data-id="${job.id}">🤍</button>
        </div>
        <div class="job-card__meta">
            ${job.company || 'Не указана'} • ${job.location || 'Удалённо'}
        </div>
        <div class="job-card__salary">${salaryText}</div>
        <div class="job-card__stack">${stackTags}</div>
    `;

    card.addEventListener('click', (e) => {
        const favBtn = e.target.closest('.job-card__favorite-btn');
        if (favBtn) {
            // Логика добавления в избранное (вызов API)
            console.log('Избранное:', favBtn.dataset.id);
        } else {
            // Переход на детальную страницу
            window.location.hash = `#job/${job.id}`;
        }
    });

    return card;
}