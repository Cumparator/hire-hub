import { HhParser } from './parsers/hhParser.js';
import { TgParser } from './parsers/tgParser.js';

const hhParser = new HhParser();
const tgParser = new TgParser();

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
  await Promise.allSettled([
    runParser('HH',       () => hhParser.fetchJobs(DEFAULT_FILTERS)),
    runParser('Telegram', () => tgParser.fetchJobs()),
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
