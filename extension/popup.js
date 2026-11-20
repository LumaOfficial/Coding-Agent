const DEFAULT_API = 'http://localhost:8000';
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

$('save').onclick = async () => {
  const apiUrl = $('api').value.trim().replace(/\/+$/, '') || DEFAULT_API;
  await chrome.storage.local.set({ apiUrl });
  setTimeout(render, 400);
};

$('reconnect').onclick = () => {
  chrome.runtime.sendMessage({ type: 'orbit:reconnect' });
  setTimeout(render, 400);
};

chrome.storage.onChanged.addListener(() => render());
render();
