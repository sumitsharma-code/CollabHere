const BASE = '/api';

async function req(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
}

export const api = {
    get:    (path)        => req(path),
    post:   (path, body)  => req(path, { method: 'POST',   body: JSON.stringify(body) }),
    put:    (path, body)  => req(path, { method: 'PUT',    body: JSON.stringify(body) }),
    patch:  (path, body)  => req(path, { method: 'PATCH',  body: JSON.stringify(body) }),
    delete: (path)        => req(path, { method: 'DELETE' }),
};
