import { BaseParser } from './BaseParser.js';

/**
 * Парсер Telegram-каналов.
 *
 * Подход для MVP:
 *   - Используем t.me/s/<channel> (публичный веб-просмотр) — без авторизации.
 *   - Для продакшена: MTProto через библиотеку gramjs (Node.js аналог Telethon).
 *     Документация: https://gram.js.org
 *
 * Список каналов задаётся в TG_CHANNELS (env или конфиг).
 */

// TODO: вынести в config или env
const DEFAULT_CHANNELS = [
  'junior_jobs_it',      // пример — заменить на реальные каналы
  'it_work_ru',
];

export class TgParser extends BaseParser {
  constructor() {
    super('tg');
    this.channels = (process.env.TG_CHANNELS ?? '').split(',').filter(Boolean)
      || DEFAULT_CHANNELS;
  }

  /**
   * @param {object} _filters — пока не используются (фильтрация post-hoc в БД)
   */
  async fetchJobs(_filters = {}) {
    const allJobs = [];

    for (const channel of this.channels) {
      try {
        const posts = await this.#fetchChannelPosts(channel);
        for (const post of posts) {
          if (!this.#looksLikeJobPost(post.text)) continue;
          allJobs.push(this.normalizeJob({ ...post, channel }));
        }
      } catch (err) {
        console.warn(`TgParser: ошибка при парсинге @${channel}:`, err.message);
      }
    }

    await this.saveJobs(allJobs);
    return allJobs;
  }

  normalizeJob(raw) {
    return {
      externalId:     `${raw.channel}_${raw.id}`,
      source:         'tg',
      url:            `https://t.me/${raw.channel}/${raw.id}`,
      title:          extractTitle(raw.text),
      company:        null,
      description:    raw.text,
      salaryMin:      extractSalaryMin(raw.text),
      salaryMax:      extractSalaryMax(raw.text),
      salaryCurrency: 'RUB',
      location:       extractLocation(raw.text),
      remote:         /удалён|remote/i.test(raw.text),
      experience:     extractExperience(raw.text),
      employment:     null,
      stack:          extractStack(raw.text),
      publishedAt:    new Date(raw.date * 1000),
      raw,
    };
  }

  /** MVP: парсим t.me/s/<channel> (HTML веб-просмотр) */
  async #fetchChannelPosts(channel) {
    const resp = await fetch(`https://t.me/s/${channel}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for @${channel}`);
    const html = await resp.text();
    return parseTelegramHtml(html);
  }

  /** Эвристика: пост похож на вакансию, если содержит ключевые слова */
  #looksLikeJobPost(text) {
    return /вакансия|ищем|требуется|junior|стажёр|стажировка/i.test(text);
  }
}

// --- Вспомогательные функции (улучшать итеративно) ---

function parseTelegramHtml(html) {
  // Очень упрощённый парсер. Для продакшена — использовать cheerio или gramjs.
  const posts = [];
  const messageRe = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  const dateRe = /<time[^>]*datetime="([^"]+)"/;
  const idRe = /data-post="[^/]+\/(\d+)"/;

  let m;
  while ((m = messageRe.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const dateMatch = dateRe.exec(m[0]);
    const idMatch = idRe.exec(m[0]);
    posts.push({
      id: idMatch?.[1] ?? String(Date.now()),
      text,
      date: dateMatch ? Math.floor(new Date(dateMatch[1]).getTime() / 1000) : Math.floor(Date.now() / 1000),
    });
  }
  return posts;
}

function extractTitle(text) {
  // Берём первую строку как заголовок
  return text.split('\n')[0].slice(0, 120).trim();
}

function extractSalaryMin(text) {
  const m = text.match(/от\s+([\d\s]+)\s*(₽|руб)/i);
  return m ? parseInt(m[1].replace(/\s/g, ''), 10) : null;
}

function extractSalaryMax(text) {
  const m = text.match(/до\s+([\d\s]+)\s*(₽|руб)/i);
  return m ? parseInt(m[1].replace(/\s/g, ''), 10) : null;
}

function extractLocation(text) {
  if (/москва/i.test(text)) return 'Москва';
  if (/питер|санкт-петербург/i.test(text)) return 'Санкт-Петербург';
  if (/удалён|remote/i.test(text)) return 'Удалённо';
  return null;
}

function extractExperience(text) {
  if (/стажёр|стажировка|intern/i.test(text)) return 'intern';
  if (/без опыта|no.experience/i.test(text)) return 'no_experience';
  return null;
}

function extractStack(text) {
  const KNOWN_STACK = [
    'python', 'javascript', 'typescript', 'java', 'go', 'rust',
    'react', 'vue', 'angular', 'node.js', 'fastapi', 'django',
    'postgresql', 'mongodb', 'redis', 'docker', 'git',
  ];
  const lower = text.toLowerCase();
  return KNOWN_STACK.filter((tech) => lower.includes(tech));
}
