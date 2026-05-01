import { HhParser } from './parsers/hhParser.js';
import { cleanupOldJobs } from './services/jobsService.js';
import { SjParser } from './parsers/sjParser.js';
import { TgParser } from './parsers/tgParser.js';

const hhParser = new HhParser();
const tgParser = new TgParser();
const sjParser = new SjParser();

const DEFAULT_FILTERS = {
  text: 'junior OR стажёр OR intern',
};

export function startCronJobs() {
  // Запускаем сразу при старте
  runAll();

  // Потом каждые 30 минут
  setInterval(runAll, 30 * 60 * 1000);
}

async function runAll() {
  console.log('[CRON] Запуск парсеров', new Date().toISOString());
  // Чистим устаревшие вакансии раз в сутки (при каждом запуске cron)
  try {
    const deleted = await cleanupOldJobs();
    if (deleted > 0) console.log(`[CRON] Cleanup: удалено ${deleted} вакансий старше 10 дней`);
  } catch (err) {
    console.error('[CRON] Cleanup error:', err.message);
  }

  await Promise.allSettled([
    runParser('HH',       () => hhParser.fetchJobs(DEFAULT_FILTERS)),
    runParser('Telegram', () => tgParser.fetchJobs()),
    runParser('SuperJob', () => sjParser.fetchJobs(DEFAULT_FILTERS)),
  ]);
}

async function runParser(name, fn) {
  try {
    const jobs = await fn();
    console.log(`[CRON] ${name}: сохранено ${jobs.length} вакансий`);
  } catch (err) {
    console.error(`[CRON] ${name}: ошибка —`, err.message);
  }
}