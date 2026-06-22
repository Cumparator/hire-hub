// frontend/src/components/SearchBar.js
// Компонент строки поиска.
// При нажатии Enter или кнопки «Найти» парсит строку через queryParser
// и вызывает onSearch(apiParams, parsed, rawInput).
// Структурированные токены (remote:, salary:, stack:, experience:) передаются
// также в "разобранном" виде, чтобы их можно было отразить в панели фильтров
// и при необходимости убрать оттуда обратно из текста поиска.

import { parseQuery, toApiParams } from '../utils/queryParser.js';

export function initSearchBar(onSearch) {
    const container = document.getElementById('search-container');
    if (!container) return;

    container.innerHTML = `
        <div class="search-bar">
            <input
                type="text"
                id="search-input"
                placeholder="Поиск: python remote:true salary:>100k stack:react,node experience:3"
                autocomplete="off"
                spellcheck="false"
            >
            <button id="search-btn">Найти</button>
        </div>
    `;

    const input = document.getElementById('search-input');
    const btn   = document.getElementById('search-btn');

    const triggerSearch = () => {
        const raw    = input.value.trim();
        const parsed = parseQuery(raw);
        const params = toApiParams(parsed);
        onSearch(params, parsed, raw);
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerSearch();
    });

    btn.addEventListener('click', triggerSearch);

    /**
     * Удаляет структурированный токен (например "salary:>90000" или
     * "stack:elixir") из текста поисковой строки и перезапускает поиск.
     * Используется, когда пользователь снимает кастомный чип в FilterPanel —
     * иначе токен остался бы в тексте и фильтр "вернулся" бы при следующем поиске.
     *
     * @param {'remote'|'salary'|'stack'|'experience'|'all'} type
     * @param {string} [value] — для type === 'stack', конкретный тег для удаления
     */
    function removeToken(type, value) {
        let text = input.value;

        if (type === 'all') {
            text = text
                .replace(/\bremote:(true|false)\b/i, '')
                .replace(/\bsalary:([><]?\d+[kK]?)\b/, '')
                .replace(/\bstack:([\w,#+.\-]+)\b/i, '')
                .replace(/\bexperience:(\d+)\b/i, '');
        } else if (type === 'remote') {
            text = text.replace(/\bremote:(true|false)\b/i, '');
        } else if (type === 'salary') {
            text = text.replace(/\bsalary:([><]?\d+[kK]?)\b/, '');
        } else if (type === 'experience') {
            text = text.replace(/\bexperience:(\d+)\b/i, '');
        } else if (type === 'stack') {
            const stackMatch = text.match(/\bstack:([\w,#+.\-]+)\b/i);
            if (stackMatch) {
                const remainingTags = stackMatch[1]
                    .split(',')
                    .map(s => s.trim())
                    .filter(tag => tag && tag.toLowerCase() !== String(value).toLowerCase());
                const replacement = remainingTags.length ? `stack:${remainingTags.join(',')}` : '';
                text = text.replace(stackMatch[0], replacement);
            }
        }

        input.value = text.replace(/\s+/g, ' ').trim();
        triggerSearch();
    }

    return { removeToken };
}