// frontend/src/components/FilterPanel.js

export function initFilterPanel(onFilter) {

    const STACK_OPTIONS = [
        'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust',
        'Java', 'Kotlin', 'Swift', 'C++', 'C#',
        'React', 'Vue', 'Angular', 'Node.js', 'Django',
        'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes',
    ];

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

    // multiple: true — можно выбрать несколько
    const EMPLOYMENT_OPTIONS = [
        { label: 'Полная',    value: 'full'     },
        { label: 'Частичная', value: 'part'     },
        { label: 'Контракт',  value: 'contract' },
    ];

    // Состояние
    const state = {
        remote:      null,    // 'true' | 'false' | null
        salaryMin:   null,
        salaryMax:   null,
        stack:       [],      // multi — OR-поиск
        experience:  [],      // multi
        employment:  [],      // multi
    };

    function buildHTML() {
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

            <div class="filters__group">
                <div class="filters__label">salary</div>
                <div class="filters__chips">
                    ${SALARY_RANGES.map((r, i) => `
                        <button class="chip" data-filter="salary" data-index="${i}">${r.label}</button>
                    `).join('')}
                </div>
            </div>

            <div class="filters__group">
                <div class="filters__label">experience</div>
                <div class="filters__chips">
                    ${EXPERIENCE_OPTIONS.map(e => `
                        <button class="chip" data-filter="experience" data-value="${e.value}">${e.label}</button>
                    `).join('')}
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
                <div class="filters__chips filters__chips--wrap">
                    ${STACK_OPTIONS.map(s => `
                        <button class="chip" data-filter="stack" data-value="${s}">${s}</button>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    const inlineEl  = document.getElementById('filters-inline');
    const sidebarEl = document.getElementById('filters-sidebar');
    if (!inlineEl || !sidebarEl) return;

    inlineEl.innerHTML  = buildHTML();
    sidebarEl.innerHTML = buildHTML();

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
        });
    }

    function applyFilters() {
        const params = {};

        if (state.remote !== null)      params.remote     = state.remote;
        if (state.stack.length)         params.stack      = state.stack.join(',');
        if (state.experience.length)    params.experience = state.experience.join(',');
        if (state.employment.length)    params.employment = state.employment.join(',');

        // salary: если выбран диапазон
        if (state.salaryMin !== null)   params.salary = `>${state.salaryMin}`;
        else if (state.salaryMax !== null) params.salary = `<${state.salaryMax}`;

        onFilter(params);
    }

    function toggleMulti(arr, value) {
        const idx = arr.indexOf(value);
        if (idx === -1) arr.push(value);
        else arr.splice(idx, 1);
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

        } else if (filter === 'experience') {
            toggleMulti(state.experience, value);

        } else if (filter === 'employment') {
            toggleMulti(state.employment, value);

        } else if (filter === 'stack') {
            toggleMulti(state.stack, value);
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
}