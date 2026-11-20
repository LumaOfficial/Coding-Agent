/* Orbit browser control — connects to the Orbit API and runs approved actions
   in the user's own tab. Read-only requests pass straight through; anything
   that changes the page only arrives here after the user approved it. */

const FALLBACK_API = 'http://localhost:8000';
/* The downloadable ZIP ships config.js with the Orbit app origin that served it. */
const PACKAGED_API = String(self.ORBIT_API || '').replace(/\/+$/, '');

let socket = null;
let retry = 0;
let status = { state: 'idle', api: PACKAGED_API || FALLBACK_API, detail: '' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getApi() {
  const { apiUrl } = await chrome.storage.local.get('apiUrl');
  const stored = String(apiUrl || '').replace(/\/+$/, '');
  // A value the user typed wins; the stock default defers to the packaged app origin.
  if (stored && stored !== FALLBACK_API) return stored;
  return PACKAGED_API || stored || FALLBACK_API;
}

function wsUrl(api) {
  return `${api.replace(/^http/, 'ws')}/browser/ws`;
}

function setStatus(next) {
  status = { ...status, ...next };
  chrome.storage.local.set({ status });
  chrome.action.setBadgeText({ text: status.state === 'connected' ? '' : '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#8b6cff' });
}

function schedule() {
  retry = Math.min(retry + 1, 6);
  setTimeout(connect, Math.min(1000 * 2 ** retry, 15000));
}

async function connect() {
  if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
  const api = await getApi();
  let next;
  try {
    next = new WebSocket(wsUrl(api));
  } catch (error) {
    setStatus({ state: 'disconnected', api, detail: error.message });
    schedule();
    return;
  }
  socket = next;
  setStatus({ state: 'connecting', api, detail: '' });

  next.onopen = () => {
    retry = 0;
    setStatus({ state: 'connected', api, detail: 'Waiting for Orbit' });
  };
  next.onclose = () => {
    if (socket === next) socket = null;
    setStatus({ state: 'disconnected', api, detail: 'Reconnecting…' });
    schedule();
  };
  next.onerror = () => {
    if (socket === next) socket = null;
    setStatus({ state: 'disconnected', api, detail: 'Could not reach the API' });
    schedule();
  };
  next.onmessage = async (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === 'execute') await execute(message);
  };
}

function reply(id, payload) {
  if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'result', id, ...payload }));
}

async function pickTab(params = {}) {
  if (Number.isFinite(Number(params.tabId))) {
    return chrome.tabs.get(Number(params.tabId)).catch(() => null);
  }
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused) return focused;
  const [any] = await chrome.tabs.query({ active: true });
  return any || null;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (error) {
    throw new Error(`Orbit is not allowed on this page (${error.message}).`);
  }
}

async function capture(tab, action) {
  if (action === 'open') await sleep(1200);
  try {
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch {
    return null;
  }
}

async function execute(message) {
  const { id, action, params = {} } = message;
  try {
    if (action === 'tabs') {
      const tabs = await chrome.tabs.query({});
      const rows = tabs
        .filter((tab) => tab.url && !tab.url.startsWith('chrome'))
        .slice(0, 30)
        .map((tab, i) => `${tab.active ? '→' : ' '} ${i + 1}. ${tab.title || '(untitled)'} — ${tab.url}`);
      reply(id, {
        ok: true,
        text: rows.length ? `Open tabs:\n${rows.join('\n')}` : 'No browser tabs are open.',
      });
      return;
    }

    const tab = await pickTab(params);
    if (!tab?.id) throw new Error('No browser tab to act on — open a page first.');

    if (action === 'open') {
      await chrome.tabs.update(tab.id, { url: params.url, active: true });
      await sleep(1200);
      const after = await chrome.tabs.get(tab.id).catch(() => tab);
      reply(id, {
        ok: true,
        text: `Opened ${after.url || params.url} in your browser.`,
        url: after.url || params.url,
        title: after.title || '',
        image: await capture(tab, 'open'),
      });
      return;
    }

    if (action === 'screenshot') {
      reply(id, {
        ok: true,
        text: `Screenshot of ${tab.title || 'your tab'}.`,
        url: tab.url,
        title: tab.title || '',
        image: await capture(tab, 'screenshot'),
      });
      return;
    }

    await ensureContentScript(tab.id);
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'orbit:action', action, params });
    if (result?.error) throw new Error(result.error);

    const after = await chrome.tabs.get(tab.id).catch(() => tab);
    reply(id, {
      ok: true,
      text: result?.text || 'Done.',
      url: after?.url || tab.url,
      title: after?.title || tab.title || '',
      image: result?.image || (await capture(tab, action)),
    });
  } catch (error) {
    reply(id, { ok: false, text: error.message || 'The browser could not run that.' });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'orbit:reconnect') return;
  try {
    socket?.close();
  } catch {
    /* already closed */
  }
  socket = null;
  retry = 0;
  connect();
});

chrome.runtime.onInstalled.addListener(() => connect());
chrome.runtime.onStartup.addListener(() => connect());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.apiUrl) {
    try {
      socket?.close();
    } catch {
      /* already closed */
    }
    socket = null;
    retry = 0;
    connect();
  }
});

connect();
