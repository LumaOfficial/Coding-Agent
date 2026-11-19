async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
  return data;
}

export const api = {
  models: () => request('/api/models'),
  integrations: () => request('/api/integrations'),
  sessions: () => request('/api/sessions'),
  createSession: (body = {}) => request('/api/sessions', { method: 'POST', body }),
  session: (id) => request(`/api/sessions/${id}`),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: 'DELETE' }),
  workspace: (id) => request(`/api/sessions/${id}/workspace`),
  file: (id, path) => request(`/api/sessions/${id}/file?path=${encodeURIComponent(path)}`),
  stores: () => request('/api/stores'),
  storeTests: (id, targets) =>
    request(`/api/sessions/${id}/store-tests`, { method: 'POST', body: { targets } }),
};

export async function streamChat({ sessionId, message, model, signal, onEvent }) {
  const res = await fetch(`/api/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
