// Компонент умной строки поиска.
// Обработка ввода (keyup/Enter), валидация, отправка события "search-triggered" в app.js.
// frontend/src/components/SearchBar.js

export function initSearchBar(onSearch) {
    const container = document.getElementById('search-container');
    if (!container) return;

    container.innerHTML = `
        <div class="search-bar">
            <input type="text" id="search-input" placeholder="Поиск вакансий (например: python remote:true)" autocomplete="off">
            <button id="search-btn">Найти</button>
        </div>
    `; // TODO: не использовать innerHTML в продакшене без санитайза, делать через createElement!!!

    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');

    const triggerSearch = () => {
        const query = input.value.trim();
        onSearch(query);
    };

    input.addEventListener('keyup', (e) => { // TODO: для лучшего accessibility, надо обернуть в форму и слушать submit, а не клик/keyup. это добавит поддержку мобильных клавиатур и экранных читалок
        if (e.key === 'Enter') {
            triggerSearch();
        }
    });

    btn.addEventListener('click', triggerSearch);
}