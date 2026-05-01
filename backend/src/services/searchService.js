import { getJobs } from './jobsService.js';
import { HhParser } from '../parsers/hhParser.js';
import { SjParser } from '../parsers/sjParser.js';
import { query } from '../db/connection.js';

const MIN_RESULTS = 50;
const STALE_DAYS  = 1;
// Максимальное окно, в течение которого фронт может продолжать автоопрос,
// пока фоновый парсинг еще идет.
const MAX_REFRESH_WINDOW_MS = 2 * 60 * 1000;
// После завершения фонового парсинга не перезапускаем его сразу же повторно
// для того же набора фильтров, даже если вакансий всё ещё меньше MIN_RESULTS.
const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;

const hhParser = new HhParser();
const sjParser = new SjParser();

// key → { startedAt: Date, attempts: number }
const inProgress = new Map();
// key → { finishedAt: Date }
const recentRefreshes = new Map();

async function checkFreshness(params) {
  const values = [];
  const conditions = [];
  const push = (v) => { values.push(v); return `$${values.length}`; };

  if (params.q) {
    const ph = push(`%${params.q.toLowerCase()}%`);
    conditions.push(`(LOWER(title) LIKE ${ph} OR LOWER(description) LIKE ${ph})`);
  }
  if (params.remote === 'true')  conditions.push(`remote = true`);
  if (params.remote === 'false') conditions.push(`remote = false`);
  if (params.experience) {
    const arr = String(params.experience).split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length === 1) conditions.push(`experience = ${push(arr[0])}`);
    else if (arr.length > 1) conditions.push(`experience IN (${arr.map(v => push(v)).join(', ')})`);
  }
  if (params.stack) {
    const arr = String(params.stack).split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length) {
      const phs = arr.map(t => push(t));
      conditions.push(`(${phs.map(ph => `${ph} ILIKE ANY(stack)`).join(' OR ')})`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT COUNT(*) as cnt, MAX(published_at) as newest FROM jobs ${where}`,
    values
  );

  const count      = Number(result.rows[0].cnt);
  const newestDate = result.rows[0].newest ? new Date(result.rows[0].newest) : null;
  const staleMs    = STALE_DAYS * 24 * 60 * 60 * 1000;
  const stale      = !newestDate || (Date.now() - newestDate.getTime()) > staleMs;

  return { count, newestDate, stale };
}

function toParserFilters(params) {
  const filters = {};
  if (params.q) filters.query = String(params.q).trim();
  if (params.stack) {
    filters.stacks = String(params.stack)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  if (params.remote === 'true') filters.schedule = 'remote';
  if (params.experience) filters.experience = String(params.experience).split(',')[0].trim();
  return filters;
}

function cacheKey(params) {
  return [params.q, params.remote, params.stack, params.experience]
    .map(v => v ?? '')
    .join('|');
}

function triggerBackgroundFetch(params) {
  const key = cacheKey(params);
  const existing = inProgress.get(key);

  if (existing) {
    existing.attempts += 1;
    // Парсер уже работает — просто инкрементируем счётчик попыток
    console.log(`[searchService] Парсинг уже идёт (${key}), попытка #${existing.attempts}`);
    return;
  }

  inProgress.set(key, { startedAt: new Date(), attempts: 1 });
  console.log(`[searchService] Запускаем фоновый парсинг: ${key}`);

  const filters = toParserFilters(params);

  Promise.allSettled([
    hhParser.fetchJobs(filters),
    sjParser.fetchJobs(filters)
  ])
    .then((results) => {
      let totalFetched = 0;
      results.forEach(res => {
        if (res.status === 'fulfilled') totalFetched += res.value.length;
      });
      console.log(`[searchService] Парсинг завершён (${key}): суммарно ${totalFetched} вакансий`);
      recentRefreshes.set(key, { finishedAt: new Date() });
    })
    .catch(err => {
      console.error(`[searchService] Ошибка парсинга (${key}):`, err.message);
    })
    .finally(() => {
      inProgress.delete(key);
    });
}

export async function smartSearch(params) {
  const [dbResult, freshness] = await Promise.all([
    getJobs(params),
    checkFreshness(params),
  ]);

  const needsRefresh = freshness.count < MIN_RESULTS || freshness.stale;
  const key = cacheKey(params);
  const progress = inProgress.get(key);
  const recentRefresh = recentRefreshes.get(key);

  // Уже парсим — ограничиваем автоопрос по времени, а не по слишком маленькому
  // числу попыток, иначе фронт может перестать ждать раньше завершения парсинга.
  const tooLongRefreshing = progress
    && (Date.now() - progress.startedAt.getTime()) >= MAX_REFRESH_WINDOW_MS;
  const inCooldown = recentRefresh
    && (Date.now() - recentRefresh.finishedAt.getTime()) < REFRESH_COOLDOWN_MS;

  let refreshing = false;
  if (needsRefresh && !tooLongRefreshing && !inCooldown) {
    triggerBackgroundFetch(params);
    refreshing = true;
  }

  if (progress && !tooLongRefreshing) {
    refreshing = true;
  }

  if (tooLongRefreshing) {
    console.warn(`[searchService] Превышено окно автоопроса для (${key}), останавливаем опрос`);
  }

  if (inCooldown) {
    console.log(`[searchService] Для (${key}) действует cooldown после недавнего парсинга`);
  }

  return {
    ...dbResult,
    refreshing,
    meta: {
      totalInDb:  freshness.count,
      newestDate: freshness.newestDate,
      stale:      freshness.stale,
    },
  };
}
