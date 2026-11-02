// Session storage and the one function that talks to the backend.

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'username';

export const session = {
    get token() {
        return localStorage.getItem(TOKEN_KEY);
    },
    get username() {
        return localStorage.getItem(USER_KEY) || '';
    },
    start({ accessToken, username }) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(USER_KEY, username);
    },
    end() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
};

export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

/** Calls the API and returns the parsed body. Errors carry the backend message; an expired session goes to /login. */
export async function api(path, { method = 'GET', body, authenticated = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authenticated) headers.Authorization = `Bearer ${session.token}`;

    let response;
    try {
        response = await fetch(path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    } catch (_) {
        throw new ApiError('No se pudo conectar con el servidor', 0);
    }

    if (response.status === 401 && authenticated) {
        session.end();
        window.location.href = '/login';
        throw new ApiError('La sesión expiró', 401);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = (data && (data.error || data.message)) || `Error del servidor (${response.status})`;
        throw new ApiError(message, response.status);
    }
    return data;
}
