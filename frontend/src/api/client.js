// frontend/src/api/client.js

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

function normalizeApiBase(rawBase) {
    if (!rawBase) return '/api';

    const trimmed = rawBase.replace(/\/+$/, '');
    if (trimmed === '/api' || trimmed.endsWith('/api')) {
        return trimmed;
    }

    return `${trimmed}/api`;
}

function generateUserId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    if (globalThis.crypto?.getRandomValues) {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20),
        ].join('-');
    }

    return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getUserId() {
    let id = localStorage.getItem('hire_hub_user_id');
    if (!id) {
        id = generateUserId();
        localStorage.setItem('hire_hub_user_id', id);
    }
    return id;
}

async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        cache: 'no-store',
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
