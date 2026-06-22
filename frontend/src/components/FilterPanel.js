// frontend/src/components/FilterPanel.js

import { trackEvent } from '../api/client.js';

/**
 * Парсит backend-формат salary (">90000" | "<50000" | "90000") в { min, max }.
 */
function parseSalaryValue(rawSalary) {
    const s = String(rawSalary).trim();
    if (s.startsWith('>')) return { min: Number(s.slice(1)), max: null };
    if (s.startsWith('<')) return { min: null, max: Number(s.slice(1)) };
    const n = Number(s);
    return { min: isNaN(n) ? null : n, max: null };
}

/**
 * Находит готовую кнопку диапазона зарплаты, точно совпадающую с {min, max}.
 * Возвращает индекс или -1, если значение не покрывается ни одной кнопкой.
 */
function findSalaryRangeIndex(min, max, SALARY_RANGES) {
    return SALARY_RANGES.findIndex(r => r.min === min && r.max === max);
}

/**
 * Человекочитаемая подпись для произвольного значения зарплаты,
 * не совпавшего ни с одной готовой кнопкой.
 */
function formatSalaryLabel(min, max) {
    const fmt = (n) => n.toLocaleString('ru-RU');
    if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
    if (min != null) return `от ${fmt(min)}`;
    if (max != null) return `до ${fmt(max)}`;
    return '';
}

export async function initFilterPanel(onFilter) {

    const STACK_OPTIONS = [
        'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust',
        'Java', 'Kotlin', 'Swift', 'C++', 'C#',
        'React', 'Vue', 'Angular', 'Node.js', 'Django',
        'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes',
    ];
    const STACK_OPTIONS_LOWER = STACK_OPTIONS.map(s => s.toLowerCase());

    const SALARY_RANGES = [
        { label: 'до 80k',   min: null,   max: 80000  },
        { label: '80–150k',  min: 80000,  max: 150000 },
        { label: '150–250k', min: 150000, max: 250000 },
        { label: '250k+',    min: 250000, max: null    },
    ];

    const EXPERIENCE_OPTIONS = [
        { label: 'Intern',  value: 'no_experience'  },
        { label: '1–3 yr',  value: 'between1And3'   },
        { label: '3–6 yr',  value: 'between3And6'   },
        { label: '6+ yr',   value: 'moreThan6'      },
    ];

    const EMPLOYMENT_OPTIONS = [
        { label: 'Полная',    value: 'full'     },
        { label: 'Частичная', value: 'part'     },
        { label: 'Контракт',  value: 'contract' },
    ];

    // Состояние, выставленное кликами по готовым кнопкам
    const state = {
        remote:      null,    // 'true' | 'false' | null
        salaryMin:   null,
        salaryMax:   null,
        stack:       [],      // multi — OR-поиск
        experience:  [],      // multi
        employment:  [],      // multi
        location:    null,    // строка — один город или null
    };

    // Значения, пришедшие из строки поиска (salary:>90k, stack:elixir, ...),
    // которые НЕ покрываются ни одной готовой кнопкой выше. Отображаются
    // отдельными "кастомными" чипами с крестиком, чтобы их можно было увидеть
    // и снять — иначе такой фильтр был бы активен, но невидим в панели.
    const custom = {
        salary:     null,   // { min, max } | null — нестандартный диапазон зарплаты
        stack:      [],     // теги стека, не входящие в STACK_OPTIONS
        experience: null,   // строка — категория experience, не входящая в EXPERIENCE_OPTIONS
    };

    // Колбэк, который сообщает SearchBar, что нужно убрать токен
    // (salary:..., stack:...) из текста поисковой строки, т.к. он
    // был снят через крестик в фильтрах.
    let onCustomRemoved = () => {};

    // Загружаем список городов с бэкенда
    let locationOptions = [];
    try {
        const resp = await fetch('/api/jobs/locations');
        if (resp.ok) {
            const data = await resp.json();
            locationOptions = data.locations || [];
        }
    } catch (e) {
        // fallback — пустой список, секция просто не покажет города
        locationOptions = [];
    }

    function buildHTML() {
        const locationSection = locationOptions.length > 0 ? `
            <div class="filters__group">
                <div class="filters__label">location</div>
                <div class="filters__chips filters__chips--wrap">
                    ${locationOptions.map(city => `
                        <button class="chip" data-filter="location" data-value="${city}">${city}</button>
                    `).join('')}
                </div>
            </div>
        ` : '';

        return `
        <div class="filters">
            <div class="filters__header">
                <span class="filters__title">// filters</span>
                <button class="filters__reset" id="filters-reset">сбросить</button>
            </div>

            <div class="filters__group">
                <div class="filters__label">remote</div>
                <div class="filters__chips">
                    <button class="chip" data-filter="remote" data-value="true">Удалённо</button>
                    <button class="chip" data-filter="remote" data-value="false">Офис</button>
                </div>
            </div>

            ${locationSection}

            <div class="filters__group">
                <div class="filters__label">salary</div>
                <div class="filters__chips filters__chips--wrap" data-group="salary">
                    ${SALARY_RANGES.map((r, i) => `
                        <button class="chip" data-filter="salary" data-index="${i}">${r.label}</button>
                    `).join('')}
                    <!-- кастомный чип зарплаты из поиска монтируется сюда динамически -->
                </div>
            </div>

            <div class="filters__group">
                <div class="filters__label">experience</div>
                <div class="filters__chips filters__chips--wrap" data-group="experience">
                    ${EXPERIENCE_OPTIONS.map(e => `
                        <button class="chip" data-filter="experience" data-value="${e.value}">${e.label}</button>
                    `).join('')}
                    <!-- кастомный чип experience из поиска монтируется сюда динамически -->
                </div>
            </div>

            <div class="filters__group">
                <div class="filters__label">employment</div>
                <div class="filters__chips">
                    ${EMPLOYMENT_OPTIONS.map(e => `
                        <button class="chip" data-filter="employment" data-value="${e.value}">${e.label}</button>
                    `).join('')}
                </div>
            </div>

            <div class="filters__group">
                <div class="filters__label">stack <span class="filters__label-hint">(OR, приоритет AND)</span></div>
                <div class="filters__chips filters__chips--wrap" data-group="stack">
                    ${STACK_OPTIONS.map(s => `
                        <button class="chip" data-filter="stack" data-value="${s}">${s}</button>
                    `).join('')}
                    <!-- кастомные чипы стека из поиска монтируются сюда динамически -->
                </div>
            </div>
        </div>`;
    }

    const inlineEl  = document.getElementById('filters-inline');
    const sidebarEl = document.getElementById('filters-sidebar');
    if (!inlineEl || !sidebarEl) return;

    inlineEl.innerHTML  = buildHTML();
    sidebarEl.innerHTML = buildHTML();

    /**
     * Рендерит кастомные чипы (значения из поиска, не покрытые готовыми
     * кнопками) внутрь групп salary/stack/experience. У каждого — крестик
     * для удаления.
     */
    function renderCustomChips() {
        [inlineEl, sidebarEl].forEach(root => {
            const salaryGroup = root.querySelector('[data-group="salary"]');
            if (salaryGroup) {
                salaryGroup.querySelectorAll('.chip--custom').forEach(el => el.remove());
                if (custom.salary) {
                    const label = formatSalaryLabel(custom.salary.min, custom.salary.max);
                    const chip = document.createElement('button');
                    chip.className = 'chip chip--custom chip--active';
                    chip.dataset.filter = 'custom-salary';
                    chip.title = 'Указано в поиске';
                    chip.innerHTML = `${label} <span class="chip__remove">×</span>`;
                    salaryGroup.appendChild(chip);
                }
            }

            const stackGroup = root.querySelector('[data-group="stack"]');
            if (stackGroup) {
                stackGroup.querySelectorAll('.chip--custom').forEach(el => el.remove());
                custom.stack.forEach(tag => {
                    const chip = document.createElement('button');
                    chip.className = 'chip chip--custom chip--active';
                    chip.dataset.filter = 'custom-stack';
                    chip.dataset.value = tag;
                    chip.title = 'Указано в поиске';
                    chip.innerHTML = `${tag} <span class="chip__remove">×</span>`;
                    stackGroup.appendChild(chip);
                });
            }

            const experienceGroup = root.querySelector('[data-group="experience"]');
            if (experienceGroup) {
                experienceGroup.querySelectorAll('.chip--custom').forEach(el => el.remove());
                if (custom.experience) {
                    const chip = document.createElement('button');
                    chip.className = 'chip chip--custom chip--active';
                    chip.dataset.filter = 'custom-experience';
                    chip.title = 'Указано в поиске';
                    chip.innerHTML = `${custom.experience} <span class="chip__remove">×</span>`;
                    experienceGroup.appendChild(chip);
                }
            }
        });
    }

    function syncUI() {
        [inlineEl, sidebarEl].forEach(root => {
            root.querySelectorAll('[data-filter="remote"]').forEach(btn => {
                btn.classList.toggle('chip--active', btn.dataset.value === state.remote);
            });
            root.querySelectorAll('[data-filter="salary"]').forEach((btn, i) => {
                const r = SALARY_RANGES[i];
                btn.classList.toggle('chip--active',
                    r.min === state.salaryMin && r.max === state.salaryMax
                );
            });
            root.querySelectorAll('[data-filter="experience"]').forEach(btn => {
                btn.classList.toggle('chip--active', state.experience.includes(btn.dataset.value));
            });
            root.querySelectorAll('[data-filter="employment"]').forEach(btn => {
                btn.classList.toggle('chip--active', state.employment.includes(btn.dataset.value));
            });
            root.querySelectorAll('[data-filter="stack"]').forEach(btn => {
                btn.classList.toggle('chip--active', state.stack.includes(btn.dataset.value));
            });
            root.querySelectorAll('[data-filter="location"]').forEach(btn => {
                btn.classList.toggle('chip--active', btn.dataset.value === state.location);
            });
        });
        renderCustomChips();
    }

    function applyFilters() {
        const params = {};

        if (state.remote !== null)      params.remote     = state.remote;
        if (state.employment.length)    params.employment = state.employment.join(',');
        if (state.location !== null)    params.location   = state.location;

        // stack: готовые кнопки + кастомные теги из поиска объединяются
        const stackAll = [...state.stack, ...custom.stack];
        if (stackAll.length) params.stack = stackAll.join(',');

        // experience: готовые кнопки + кастомная категория из поиска
        // (значение, не входящее в EXPERIENCE_OPTIONS) объединяются
        const experienceAll = custom.experience
            ? [...state.experience, custom.experience]
            : state.experience;
        if (experienceAll.length) params.experience = experienceAll.join(',');

        // salary: кастомное значение из поиска имеет приоритет, если задано,
        // иначе берём готовый диапазон
        if (custom.salary) {
            const { min, max } = custom.salary;
            params.salary = min != null ? `>${min}` : `<${max}`;
        } else if (state.salaryMin !== null) {
            params.salary = `>${state.salaryMin}`;
        } else if (state.salaryMax !== null) {
            params.salary = `<${state.salaryMax}`;
        }

        trackEvent('filter_apply');
        onFilter(params);
    }

    function toggleMulti(arr, value) {
        const idx = arr.indexOf(value);
        if (idx === -1) arr.push(value);
        else arr.splice(idx, 1);
    }

    function clearCustomSalary() {
        if (!custom.salary) return;
        custom.salary = null;
        onCustomRemoved({ type: 'salary' });
    }

    function clearCustomStackTag(tag) {
        const idx = custom.stack.indexOf(tag);
        if (idx === -1) return;
        custom.stack.splice(idx, 1);
        onCustomRemoved({ type: 'stack', value: tag });
    }

    function clearCustomExperience() {
        if (!custom.experience) return;
        custom.experience = null;
        onCustomRemoved({ type: 'experience' });
    }

    function handleClick(e) {
        // Сброс
        if (e.target.closest('#filters-reset')) {
            state.remote = null;
            state.salaryMin = null;
            state.salaryMax = null;
            state.stack = [];
            state.experience = [];
            state.employment = [];
            state.location = null;

            const hadCustom = custom.salary || custom.stack.length || custom.experience;
            custom.salary = null;
            custom.stack = [];
            custom.experience = null;
            if (hadCustom) onCustomRemoved({ type: 'all' });

            syncUI();
            applyFilters();
            return;
        }

        // Удаление кастомного чипа зарплаты (пришёл из поиска)
        const removeSalary = e.target.closest('[data-filter="custom-salary"]');
        if (removeSalary) {
            clearCustomSalary();
            syncUI();
            applyFilters();
            return;
        }

        // Удаление кастомного чипа стека (пришёл из поиска)
        const removeStack = e.target.closest('[data-filter="custom-stack"]');
        if (removeStack) {
            clearCustomStackTag(removeStack.dataset.value);
            syncUI();
            applyFilters();
            return;
        }

        // Удаление кастомного чипа experience (пришёл из поиска)
        const removeExperience = e.target.closest('[data-filter="custom-experience"]');
        if (removeExperience) {
            clearCustomExperience();
            syncUI();
            applyFilters();
            return;
        }

        const btn = e.target.closest('.chip');
        if (!btn) return;

        const { filter, value, index } = btn.dataset;

        if (filter === 'remote') {
            // toggle: повторный клик снимает
            state.remote = state.remote === value ? null : value;

        } else if (filter === 'salary') {
            const r = SALARY_RANGES[Number(index)];
            const alreadyActive = r.min === state.salaryMin && r.max === state.salaryMax;
            state.salaryMin = alreadyActive ? null : r.min;
            state.salaryMax = alreadyActive ? null : r.max;
            // Явный выбор готового диапазона перекрывает кастомное значение из поиска
            if (!alreadyActive && custom.salary) clearCustomSalary();

        } else if (filter === 'experience') {
            toggleMulti(state.experience, value);
            // Явный выбор готовой категории перекрывает кастомное значение из поиска
            if (custom.experience) clearCustomExperience();

        } else if (filter === 'employment') {
            toggleMulti(state.employment, value);

        } else if (filter === 'stack') {
            toggleMulti(state.stack, value);

        } else if (filter === 'location') {
            // toggle: повторный клик снимает
            state.location = state.location === value ? null : value;
        }

        syncUI();
        applyFilters();
    }

    inlineEl.addEventListener('click', handleClick);
    sidebarEl.addEventListener('click', handleClick);

    // Сайдбар появляется когда inline уходит из viewport
    const observer = new IntersectionObserver(
        ([entry]) => {
            sidebarEl.classList.toggle('filters-sidebar--visible', !entry.isIntersecting);
        },
        { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
    );
    observer.observe(inlineEl);

    /**
     * Синхронизирует панель фильтров со структурированными параметрами,
     * распарсенными из строки поиска (salary:>90k, stack:elixir, remote:true...).
     *
     * Для каждого параметра:
     *  — если он совпадает с готовой кнопкой, подсвечиваем эту кнопку
     *    (как если бы пользователь кликнул по ней сам);
     *  — если не совпадает ни с одной (нестандартная зарплата, тег стека
     *    не из списка) — кладём в custom.* и рисуем отдельный чип с крестиком,
     *    чтобы фильтр был виден и его можно было снять.
     *
     * @param {{ remote: string|null, salary: string|null, stack: string|null, experience: string|null }} parsed
     */
    function applyFromSearch(parsed) {
        // remote — категорий только две, маппинг прямой
        state.remote = parsed.remote ?? null;

        // salary
        if (parsed.salary) {
            const { min, max } = parseSalaryValue(parsed.salary);
            const idx = findSalaryRangeIndex(min, max, SALARY_RANGES);
            if (idx !== -1) {
                state.salaryMin = SALARY_RANGES[idx].min;
                state.salaryMax = SALARY_RANGES[idx].max;
                custom.salary = null;
            } else {
                state.salaryMin = null;
                state.salaryMax = null;
                custom.salary = { min, max };
            }
        } else {
            state.salaryMin = null;
            state.salaryMax = null;
            custom.salary = null;
        }

        // stack — теги из готового списка подсвечиваются кнопками,
        // остальные становятся кастомными чипами
        if (parsed.stack) {
            const tags = parsed.stack.split(',').map(s => s.trim()).filter(Boolean);
            state.stack = [];
            custom.stack = [];
            tags.forEach(tag => {
                const optIdx = STACK_OPTIONS_LOWER.indexOf(tag.toLowerCase());
                if (optIdx !== -1) state.stack.push(STACK_OPTIONS[optIdx]);
                else custom.stack.push(tag);
            });
        } else {
            state.stack = [];
            custom.stack = [];
        }

        // experience — queryParser.js приводит значение к одной из канонических
        // категорий (no_experience / between1And3 / between3And6 / moreThan6),
        // если распознал алиас. Точное совпадение с кнопкой — подсвечиваем её;
        // иначе (значение не из списка, например опечатка или незнакомая
        // категория) — показываем отдельным кастомным чипом с крестиком,
        // а не тычем в случайную кнопку.
        if (parsed.experience) {
            const known = EXPERIENCE_OPTIONS.some(e => e.value === parsed.experience);
            if (known) {
                state.experience = [parsed.experience];
                custom.experience = null;
            } else {
                state.experience = [];
                custom.experience = parsed.experience;
            }
        } else {
            state.experience = [];
            custom.experience = null;
        }

        syncUI();
        applyFilters();
    }

    /**
     * Регистрирует колбэк, который вызывается, когда пользователь снимает
     * кастомный чип (тот, что пришёл из строки поиска). app.js использует
     * это, чтобы убрать соответствующий токен из текста поиска.
     */
    function setOnCustomRemoved(cb) {
        onCustomRemoved = cb;
    }

    return { applyFromSearch, setOnCustomRemoved };
}
