/**
 * Talks to the Orbit API from either place the UI runs:
 *
 * - the Vite dev server / a hosted web page, where `/api` is same-origin and
 *   the httpOnly session cookie authenticates every call;
 * - the Chrome extension page, where the API is a different origin
 *   (`http://localhost:8000` by default, set in the extension popup), so calls
 *   carry the signed token as a bearer header and `chrome.storage.local` holds
 *   the API address shared with the background worker.
 */

const EXTENSION = typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);
const DEFAULT_API = 'http://localhost:8000';
const TOKEN_KEY = 'orbit.token';

const normalizeBase = (value) => String(value || DEFAULT_API).trim().replace(/\/+$/, '');

export const isExtension = EXTENSION;

let apiBase = EXTENSION ? DEFAULT_API : '';

const baseReady = EXTENSION
  ? chrome.storage.local
      .get('apiUrl')
      .then(({ apiUrl }) => {
        apiBase = normalizeBase(apiUrl);
      })
      .catch(() => {})
  : Promise.resolve();

if (EXTENSION) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.apiUrl) apiBase = normalizeBase(changes.apiUrl.newValue);
  });
}

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function storeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage can be unavailable — the session still lasts for this page */
  }
}

async function urlFor(path) {
  await baseReady;
  return `${apiBase}${path}`;
}

function credentialsMode() {
  return EXTENSION ? 'include' : 'same-origin';
}

function headersFor(body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (EXTENSION) {
    const token = readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(await urlFor(path), {
    method,
    credentials: credentialsMode(),
    headers: headersFor(body),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if (EXTENSION && data.token) storeToken(data.token);
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  logout: async () => {
    const data = await request('/api/auth/logout', { method: 'POST' });
    if (EXTENSION) storeToken('');
    return data;
  },
  markOnboarded: () => request('/api/auth/onboarded', { method: 'POST' }),
  models: () => request('/api/models'),
  integrations: () => request('/api/integrations'),
  platform: () => request('/api/platform'),
  platforms: (refresh = false) => request(`/api/platforms${refresh ? '?refresh=1' : ''}`),
  sessions: () => request('/api/sessions'),
  createSession: (body = {}) => request('/api/sessions', { method: 'POST', body }),
  session: (id) => request(`/api/sessions/${id}`),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: 'DELETE' }),
  workspace: (id) => request(`/api/sessions/${id}/workspace`),
  file: (id, path) => request(`/api/sessions/${id}/file?path=${encodeURIComponent(path)}`),
  stores: () => request('/api/stores'),
  scan: (id) => request(`/api/sessions/${id}/scan`),
  autofix: (id) => request(`/api/sessions/${id}/autofix`, { method: 'POST' }),
  closeDesktop: (id) => request(`/api/sessions/${id}/desktop/close`, { method: 'POST' }),
  browserStatus: () => request('/api/browser/status'),
  approveBrowser: (id, approved) =>
    request('/api/browser/approve', { method: 'POST', body: { id, approved } }),
  approveConsent: (id, approved) =>
    request('/api/consent/approve', { method: 'POST', body: { id, approved } }),
  storeTests: (id, targets) =>
    request(`/api/sessions/${id}/store-tests`, { method: 'POST', body: { targets } }),
};

/** Saves an authenticated API download (workspace ZIP, extension package). */
export async function downloadFile(path, filename) {
  const res = await fetch(await urlFor(path), {
    credentials: credentialsMode(),
    headers: headersFor(null),
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const href = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = href;
  link.download = filename || 'download';
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

/** Loads an authenticated image (desktop screenshots) into a blob URL. */
export async function loadImage(path) {
  const res = await fetch(await urlFor(path), {
    credentials: credentialsMode(),
    headers: headersFor(null),
  });
  if (!res.ok) throw new Error(`Image failed (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

export async function streamChat({ sessionId, message, model, signal, onEvent }) {
  const res = await fetch(await urlFor(`/api/sessions/${sessionId}/chat`), {
    method: 'POST',
    credentials: credentialsMode(),
    headers: headersFor({ message }),
    body: JSON.stringify({ message, model }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Request failed (${res.status})`;
    try {
      msg = JSON.parse(text).error || msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload));
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
}
