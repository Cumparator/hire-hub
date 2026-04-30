import { fetchJobById } from '../api/client.js';

export async function renderJobDetail(jobId) {
    const container = document.getElementById('job-detail-content');
    container.innerHTML = '<p class="loading">Загрузка вакансии...</p>';

    try {
        const job = await fetchJobById(jobId);
        
        let salaryText = 'Не указана';
        if (job.salary_min && job.salary_max) salaryText = `от ${job.salary_min} до ${job.salary_max} ${job.salary_currency}`;
        else if (job.salary_min) salaryText = `от ${job.salary_min} ${job.salary_currency}`;
        else if (job.salary_max) salaryText = `до ${job.salary_max} ${job.salary_currency}`;

        container.innerHTML = `
            <div class="job-detail__header">
                <h2>${job.title}</h2>
                <div class="job-detail__meta">
                    <span>🏢 ${job.company || 'Компания не указана'}</span>
                    <span>📍 ${job.location || 'Локация не указана'}</span>
                    <span>💰 ${salaryText}</span>
                </div>
            </div>
            
            <div class="job-detail__body">
                ${job.description || '<p>Описание отсутствует</p>'}
            </div>
            
            <div class="job-detail__footer">
                <a href="${job.url}" target="_blank" class="btn btn--primary">Откликнуться на источнике</a>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p class="error">Ошибка загрузки: ${err.message}</p>`;
    }
}