/**
 * queryParser.js
 * Парсит строку из поля поиска в объект параметров для API.
 *
 * Синтаксис строки (порядок произвольный):
 *   senior react remote:true salary:>100000 stack:react,node experience:3
 *
 * Поддерживаемые ключи:
 *   remote:true|false         — формат работы
 *   salary:>N | <N | N        — зарплата (поддерживает k: 80k → 80000)
 *   stack:tech1,tech2         — стек через запятую
 *   experience:N              — лет опыта
 *
 * Всё остальное → freetext (поиск по title/description)
 */

const PATTERNS = {
  remote:     /\bremote:(true|false)\b/i,
  salary:     /\bsalary:([><]?\d+[kK]?)\b/,
  stack:      /\bstack:([\w,#+.\-]+)\b/i,
  experience: /\bexperience:(\d+)\b/i,
};

/**
 * Нормализует число с суффиксом k: "80k" → "80000", ">80k" → ">80000"
 * @param {string} raw
 * @returns {string}
 */
function normalizeSalary(raw) {
  return raw.replace(/(\d+)[kK]/, (_, n) => String(Number(n) * 1000));
}

/**
 * Парсит строку поиска.
 *
 * @param {string} input
 * @returns {{
 *   freetext: string,
 *   remote: 'true'|'false'|null,
 *   salary: string|null,
 *   stack: string|null,
 *   experience: string|null,
 * }}
 */
export function parseQuery(input) {
  const result = {
    freetext:   '',
    remote:     null,
    salary:     null,
    stack:      null,
    experience: null,
  };

  if (!input || !input.trim()) return result;

  let remaining = input.trim();

  const remoteMatch = remaining.match(PATTERNS.remote);
  if (remoteMatch) {
    result.remote = remoteMatch[1].toLowerCase();
    remaining = remaining.replace(remoteMatch[0], '');
  }

  const salaryMatch = remaining.match(PATTERNS.salary);
  if (salaryMatch) {
    result.salary = normalizeSalary(salaryMatch[1]);
    remaining = remaining.replace(salaryMatch[0], '');
  }

  const stackMatch = remaining.match(PATTERNS.stack);
  if (stackMatch) {
    result.stack = stackMatch[1]
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .join(',');
    remaining = remaining.replace(stackMatch[0], '');
  }

  const expMatch = remaining.match(PATTERNS.experience);
  if (expMatch) {
    result.experience = expMatch[1];
    remaining = remaining.replace(expMatch[0], '');
  }

  result.freetext = remaining.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Конвертирует результат parseQuery() в plain object для fetchJobs().
 *
 * @param {ReturnType<parseQuery>} parsed
 * @param {{ page?: number, per_page?: number }} [pagination]
 * @returns {Record<string, string>}
 */
export function toApiParams(parsed, { page = 1, per_page = 20 } = {}) {
  const params = {};

  if (parsed.freetext)   params.q          = parsed.freetext;
  if (parsed.remote)     params.remote     = parsed.remote;
  if (parsed.salary)     params.salary     = parsed.salary;
  if (parsed.stack)      params.stack      = parsed.stack;
  if (parsed.experience) params.experience = parsed.experience;
  if (page > 1)          params.page       = String(page);
  if (per_page !== 20)   params.per_page   = String(per_page);

  return params;
}