const FALLBACK_API = 'http://localhost:8000';
const PACKAGED_API = String(self.ORBIT_API || '').replace(/\/+$/, '');
const defaultApi = PACKAGED_API || FALLBACK_API;
const $ = (id) => document.getElementById(id);

async function render() {
  const { apiUrl, status } = await chrome.storage.local.get(['apiUrl', 'status']);
  const stored = String(apiUrl || '').replace(/\/+$/, '');
  $('api').value = stored && stored !== FALLBACK_API ? stored : defaultApi;
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
  const apiUrl = $('api').value.trim().replace(/\/+$/, '') || defaultApi;
  await chrome.storage.local.set({ apiUrl });
  setTimeout(render, 400);
};

$('reconnect').onclick = () => {
  chrome.runtime.sendMessage({ type: 'orbit:reconnect' });
  setTimeout(render, 400);
};

chrome.storage.onChanged.addListener(() => render());
render();
