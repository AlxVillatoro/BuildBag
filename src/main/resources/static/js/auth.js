// Login and registration: the same form with a few extra fields in register mode.
import { api, session } from './api.js';

const form = document.getElementById('auth-form');
const card = document.getElementById('auth-card');
const message = document.getElementById('auth-message');
const submit = form.querySelector('[type="submit"]');
const isRegister = form.dataset.mode === 'register';

function showError(text) {
    message.textContent = text;
    message.hidden = false;
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
}

function updateStrength(password) {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    score = Math.min(score, 4);

    document.getElementById('strength').dataset.score = String(score);
    document.getElementById('strength-text').textContent =
        ['Mínimo 6 caracteres', 'Muy débil', 'Débil', 'Buena', 'Muy fuerte'][score];
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    const { username, password, confirmPassword } = Object.fromEntries(new FormData(form));
    message.hidden = true;

    if (isRegister && password !== confirmPassword) {
        showError('Las contraseñas no coinciden');
        return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    try {
        const path = isRegister ? '/api/auth/register' : '/api/auth/login';
        const body = { username, password };
        session.start(await api(path, { method: 'POST', body, authenticated: false }));
        window.location.href = '/panel';
    } catch (error) {
        showError(error.message);
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
    }
});

document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-action="toggle-password"]');
    if (!toggle) return;
    const input = toggle.parentElement.querySelector('input');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggle.setAttribute('aria-pressed', String(!showing));
});

if (isRegister) {
    form.elements.password.addEventListener('input', event => updateStrength(event.target.value));
}

// Someone with a valid session has nothing to do on this page
if (session.token) {
    api('/api/auth/validate').then(() => {
        window.location.href = '/panel';
    }).catch(() => {});
}
