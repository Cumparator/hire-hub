// frontend/src/components/SearchBar.js
// Компонент строки поиска.
// При нажатии Enter или кнопки «Найти» парсит строку через queryParser
// и вызывает onSearch(apiParams).

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
        onSearch(params);
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerSearch();
    });

    btn.addEventListener('click', triggerSearch);
}