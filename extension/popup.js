const DEFAULT_API = 'http://localhost:8000';
const APP_PAGE = 'app/index.html';
const $ = (id) => document.getElementById(id);

async function render() {
  const { apiUrl, status } = await chrome.storage.local.get(['apiUrl', 'status']);
  $('api').value = apiUrl || DEFAULT_API;
  const state = status?.state || 'idle';
  $('dot').className = `dot ${state === 'connected' ? 'connected' : state === 'disconnected' ? 'disconnected' : ''}`;
  $('state').textContent =
    state === 'connected'
      ? `Connected · ${status.api}`
      : state === 'connecting'
        ? 'Connecting…'
        : status?.detail || 'Not connected';
}

function openApp() {
  chrome.tabs.create({ url: chrome.runtime.getURL(APP_PAGE) });
}

$('save').onclick = async () => {
  const apiUrl = $('api').value.trim().replace(/\/+$/, '') || DEFAULT_API;
  await chrome.storage.local.set({ apiUrl });
  setTimeout(render, 400);
};

$('reconnect').onclick = () => {
  chrome.runtime.sendMessage({ type: 'orbit:reconnect' });
  setTimeout(render, 400);
};

$('open').onclick = openApp;

$('panel').onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.windowId === undefined) throw new Error('no window');
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch {
    openApp();
  }
};

chrome.storage.onChanged.addListener(() => render());
render();
