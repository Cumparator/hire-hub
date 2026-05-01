// frontend/src/components/JobCard.js
// Карточка вакансии.

import { trackJobClick } from '../api/client.js';

export function createJobCard(job, isFavorite = false, onToggleFavorite, { currentUser, openAuthModal } = {}) {
  const card = document.createElement('div');
  card.className = 'job-card';
  card.dataset.id = job.id;

  const localDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(job.publishedAt));

  let salaryText = 'З/П не указана';
  if (job.salaryMin && job.salaryMax) {
    salaryText = `от ${job.salaryMin} до ${job.salaryMax} ${job.salaryCurrency}`;
  } else if (job.salaryMin) {
    salaryText = `от ${job.salaryMin} ${job.salaryCurrency}`;
  }

  // Генерация HTML с ссылкой на внутреннюю страницу
  card.innerHTML = `
    <div class="job-card__header">
      <h3 class="job-card__title">
        <a href="#job/${job.id}" class="job-card__link">${job.title}</a>
      </h3>
      <button class="job-card__fav-btn ${isFavorite ? 'active' : ''}">
        ${isFavorite ? '★ В избранном' : '☆ Сохранить'}
      </button>
    </div>
    <div class="job-card__company">${job.company || 'Компания не указана'} • ${job.location || 'Локация не указана'}</div>
    <div class="job-card__salary">${salaryText}</div>
    <div class="job-card__stack">
      ${job.stack.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
    </div>
    <div class="job-card__footer">
      <span class="job-card__date">${localDate}</span>
      <span class="job-card__source tag-${job.source}">${job.source}</span>
    </div>
  `; // TODO: не использовать innerHTML в продакшене без санитайза, делать через createElement!!!

  // ── Избранное ────────────────────────────────────────────────────────────
  const favBtn = card.querySelector('.job-card__fav-btn');
  favBtn.addEventListener('click', (e) => {
    e.preventDefault();
    onToggleFavorite(job.id, !favBtn.classList.contains('active'), favBtn);
  });

  return card;
}
