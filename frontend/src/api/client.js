const API_BASE = import.meta?.env?.VITE_API_URL ?? 'http://localhost:4000';

// MVP: userId хранится в localStorage (заменить на нормальную авторизацию позже)
function getUserId() {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('userId', id);
  }
  return id;
}

function authHeaders() {
  return { 'X-User-Id': getUserId() };
}

async function handleResponse(resp) {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
    throw Object.assign(new Error(err.error), { status: resp.status, code: err.code });
  }
  if (resp.status === 204) return null;
  return resp.json();
}

/**
 * Получить список вакансий.
 * @param {object} params
 * @param {string}  [params.q]           — поисковый запрос
 * @param {boolean} [params.remote]
 * @param {string}  [params.experience]  — 'intern' | 'no_experience' | 'between1And3'
 * @param {string}  [params.stack]       — 'Python,React'
 * @param {number}  [params.salary_from]
 * @param {number}  [params.page]
 * @param {number}  [params.per_page]
 * @returns {Promise<{ jobs: Job[], pagination: object }>}
 */
export async function fetchJobs(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString();
  const resp = await fetch(`${API_BASE}/api/jobs${qs ? '?' + qs : ''}`);
  return handleResponse(resp);
}

/**
 * @returns {Promise<{ jobs: Job[] }>}
 */
export async function fetchFavorites() {
  const resp = await fetch(`${API_BASE}/api/favorites`, {
    headers: authHeaders(),
  });
  return handleResponse(resp);
}

/**
 * @param {string} jobId
 * @returns {Promise<{ favoriteId: string }>}
 */
export async function addFavorite(jobId) {
  const resp = await fetch(`${API_BASE}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ jobId }),
  });
  return handleResponse(resp);
}

/**
 * @param {string} jobId
 */
export async function removeFavorite(jobId) {
  const resp = await fetch(`${API_BASE}/api/favorites/${jobId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(resp);
}
