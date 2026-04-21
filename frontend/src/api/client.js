// frontend/src/api/client.js

const API_BASE = 'http://localhost:4000/api';

function getUserId() {
    let id = localStorage.getItem('hire_hub_user_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('hire_hub_user_id', id);
    }
    return id;
}

async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': getUserId(),
            ...options.headers,
        },
    });

    if (res.status === 204) return null;

    const text = await res.text();
    try {
        const data = JSON.parse(text);
        if (!res.ok) throw Object.assign(new Error(data.error || 'API error'), { code: data.code, status: res.status });
        return data;
    } catch (e) {
        throw new Error(`Сервер вернул не JSON (${res.status}): ${text.slice(0, 200)}`);
    }
}

export async function fetchJobs(params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    }
    return apiFetch(`/jobs?${qs}`);
}

export async function fetchFavorites() {
    return apiFetch('/favorites');
}

export async function addFavorite(jobId) {
    return apiFetch('/favorites', {
        method: 'POST',
        body: JSON.stringify({ jobId }),
    });
}

export async function removeFavorite(jobId) {
    return apiFetch(`/favorites/${jobId}`, { method: 'DELETE' });
}
