import express from 'express';
import archiver from 'archiver';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  init,
  listSessions,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getMessages,
  addMessage,
  listWorkspaceFiles,
  readWorkspaceFile,
  workspaceDir,
  claimOwnerlessSessions,
} from './store.js';
import {
  apiAuth,
  clearSessionCookie,
  completeOnboarding,
  initAuth,
  issueToken,
  readSessionToken,
  revokeToken,
  setSessionCookie,
  signIn,
  signUp,
} from './auth.js';
import { runAgent } from './agent.js';
import { MODEL, configStatus } from './cloudflare.js';
import { fixWorkspace, scanWorkspace } from './autofix.js';
import { detectPlatform } from './platform.js';
import { platformStatuses } from './platforms.js';
import { listStoreTargets, runStoreTests } from './stores.js';
import {
  closeAllDesktops,
  closeDesktop,
  desktopStatus,
  reapOrphanDesktops,
  screenshotDir,
} from './desktop.js';
import {
  attachBrowserSocket,
  browserStatus,
  cancelSession,
  resolveApproval,
  subscribeSession,
} from './browser.js';
import { resolveConsent } from './consent.js';

const app = express();
const PORT = Number(process.env.PORT || 8000);
const extensionDir = fileURLToPath(new URL('../extension', import.meta.url));
const appRoot = fileURLToPath(new URL('..', import.meta.url));

// The download is one zip whose root is the extension itself (manifest.json first,
// no wrapping extension/ folder) with the API (server/) and the client (client/)
// inside it, so extracting gives a single folder that Chrome can load unpacked and
// that also carries everything the extension talks to.
const extensionReadme = `Orbit - browser extension

This folder is the whole package: the extension itself (manifest.json and the files
next to it), the API in server/ and the web client in client/.

1. Load the extension
   chrome://extensions -> turn on Developer mode -> Load unpacked -> pick THIS folder
   (the one that contains manifest.json).

2. Start the API
   cd server && npm install && npm start        # http://localhost:8000

3. Start the client (optional, the extension does not need it)
   cd client && npm install && npm run dev      # http://localhost:5173

4. Open the Orbit popup. It already points at the Orbit app this ZIP came from;
   press Save & connect (edit the address only if you run the API somewhere else).
`;

app.use(express.json({ limit: '8mb' }));
app.use('/api', apiAuth);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user || null });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const user = await signUp(req.body || {});
    await claimOwnerlessSessions(user.id);
    setSessionCookie(res, await issueToken(user.id));
    res.status(201).json({ user });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Could not create the account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await signIn(req.body || {});
    setSessionCookie(res, await issueToken(user.id));
    res.json({ user });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Could not sign in.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  await revokeToken(readSessionToken(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/onboarded', async (req, res) => {
  const user = await completeOnboarding(req.user.id);
  res.json({ user });
});

app.get('/api/models', (req, res) => {
  res.json({ models: [MODEL], default: MODEL.id, mode: 'cloudflare' });
});

app.get('/api/platform', (req, res) => {
  res.json(detectPlatform(req.headers));
});

app.get('/api/desktop/status', (req, res) => {
  res.json(desktopStatus());
});

app.use('/api/desktop/screenshots', express.static(screenshotDir, { maxAge: '1h' }));

app.get('/api/platforms', async (req, res) => {
  const platforms = await platformStatuses({ refresh: req.query.refresh === '1' });
  res.json({ platforms });
});

app.get('/api/stores', (req, res) => {
  res.json({ targets: listStoreTargets() });
});

let integrationCache = { at: 0, data: null };

async function probeGitHub() {
  const auth = process.env.GITHUB_TOKEN;
  if (auth) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${auth}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) return { connected: false, error: `Token rejected (${res.status})` };
      const user = await res.json();
      return { connected: true, login: user.login, avatar: user.avatar_url, mode: 'token' };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  // No token: public reads still work, so report the real anonymous state.
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      return { connected: false, readOnly: true, mode: 'anonymous', ok: false, error: `GitHub ${res.status}` };
    }
    const data = await res.json();
    const core = data.resources?.core || {};
    return {
      connected: false,
      readOnly: true,
      mode: 'anonymous',
      ok: true,
      login: 'public read only',
      limit: core.limit ?? 60,
      remaining: core.remaining ?? null,
    };
  } catch (error) {
    return { connected: false, readOnly: true, mode: 'anonymous', ok: false, error: error.message };
  }
}

async function probeHuggingFace() {
  const token = process.env.HF_TOKEN;
  if (token) {
    try {
      const res = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { connected: false, error: `Token rejected (${res.status})` };
      const data = await res.json();
      return { connected: true, name: data.name || data.fullname, mode: 'token' };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  // No token: public search and model cards are open.
  try {
    const res = await fetch('https://huggingface.co/api/models?limit=1');
    if (!res.ok) {
      return { connected: false, mode: 'public', ok: false, error: `Hugging Face ${res.status}` };
    }
    return { connected: false, mode: 'public', ok: true, name: 'public search' };
  } catch (error) {
    return { connected: false, mode: 'public', ok: false, error: error.message };
  }
}

app.get('/api/integrations', async (req, res) => {
  if (integrationCache.data && Date.now() - integrationCache.at < 30_000) {
    return res.json({ ...integrationCache.data, browser: browserStatus() });
  }
  const [github, huggingface] = await Promise.all([probeGitHub(), probeHuggingFace()]);
  const cloudflare = configStatus();
  const data = {
    engine: {
      mode: 'cloudflare',
      model: MODEL.id,
      label: MODEL.label,
      connected: cloudflare.configured,
      missing: cloudflare.missing,
    },
    github,
    huggingface,
    desktop: { ...desktopStatus(), provider: 'E2B', idleMinutes: 3 },
    browser: browserStatus(),
  };
  integrationCache = { at: Date.now(), data };
  res.json(data);
});

app.get('/api/browser/status', (req, res) => {
  res.json(browserStatus());
});

app.post('/api/browser/approve', (req, res) => {
  const id = String(req.body?.id || '');
  if (!id) return res.status(400).json({ error: 'id is required' });
  res.json({ ok: resolveApproval(id, Boolean(req.body?.approved)) });
});

app.post('/api/consent/approve', (req, res) => {
  const id = String(req.body?.id || '');
  if (!id) return res.status(400).json({ error: 'id is required' });
  res.json({ ok: resolveConsent(id, Boolean(req.body?.approved)) });
});

app.get('/api/browser/extension.zip', (req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="orbit-extension.zip"');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', () => res.destroy());
  archive.pipe(res);

  // The extension connects back to the app it was downloaded from, so the popup is
  // already pointed at the right API and nothing has to be typed in.
  const requested = String(req.query.origin || '').replace(/\/+$/, '');
  const origin = /^https?:\/\/[^/]+$/i.test(requested) ? requested : '';

  const skip = ['**/node_modules/**', '**/dist/**', '**/.data/**'];
  archive.glob('**/*', { cwd: extensionDir, dot: true, ignore: ['config.js'] });
  archive.append(`self.ORBIT_API = ${JSON.stringify(origin)};\n`, { name: 'config.js' });
  archive.append(extensionReadme, { name: 'README.txt' });
  archive.glob('server/**/*', { cwd: appRoot, dot: true, ignore: skip });
  archive.glob('client/**/*', { cwd: appRoot, dot: true, ignore: skip });
  archive.finalize();
});

async function ownedSession(req, res) {
  const session = await getSession(req.params.id);
  if (!session || session.owner !== req.user.id) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  return session;
}

app.get('/api/sessions', async (req, res) => {
  res.json({ sessions: await listSessions(req.user.id) });
});

app.post('/api/sessions', async (req, res) => {
  const session = await createSession({
    title: req.body?.title || 'New session',
    model: MODEL.id,
    owner: req.user.id,
  });
  res.status(201).json({ session });
});

app.get('/api/sessions/:id', async (req, res) => {
  const session = await ownedSession(req, res);
  if (!session) return;
  const [messages, files] = await Promise.all([
    getMessages(req.params.id),
    listWorkspaceFiles(req.params.id),
  ]);
  res.json({ session, messages, files });
});

app.patch('/api/sessions/:id', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  const session = await updateSession(req.params.id, {
    ...(req.body?.title !== undefined ? { title: req.body.title } : {}),
    ...(req.body?.model !== undefined ? { model: req.body.model } : {}),
  });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

app.delete('/api/sessions/:id', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  await closeDesktop(req.params.id);
  await deleteSession(req.params.id);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/desktop/close', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  const closed = await closeDesktop(req.params.id);
  res.json({ ok: true, closed });
});

app.get('/api/sessions/:id/workspace', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  res.json({ files: await listWorkspaceFiles(req.params.id) });
});

app.get('/api/sessions/:id/file', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  try {
    const content = await readWorkspaceFile(req.params.id, String(req.query.path || ''));
    res.json({ path: req.query.path, content });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/export.zip', async (req, res) => {
  const session = await ownedSession(req, res);
  if (!session) return;

  const slug = (session.title || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'workspace';

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', () => res.destroy());
  archive.pipe(res);
  archive.directory(workspaceDir(req.params.id), false);
  await archive.finalize();
});

app.post('/api/sessions/:id/chat', async (req, res) => {
  const session = await ownedSession(req, res);
  if (!session) return;

  const message = String(req.body?.message || '').trim();
  const model = MODEL.id;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const emit = (payload) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const unsubscribe = subscribeSession(req.params.id, emit);

  try {
    await addMessage(req.params.id, { role: 'user', content: message });

    if (session.title === 'New session' || !session.title) {
      const title = message.replace(/\s+/g, ' ').slice(0, 60);
      await updateSession(req.params.id, { title, model });
    } else if (model !== session.model) {
      await updateSession(req.params.id, { model });
    }

    emit({ type: 'user_saved', message });

    await runAgent({ sessionId: req.params.id, emit });
  } catch (error) {
    if (error.name !== 'AbortError') {
      emit({ type: 'error', message: error.message || 'Agent failed' });
    }
  } finally {
    unsubscribe();
    cancelSession(req.params.id);
    if (!res.writableEnded) res.end();
  }
});

app.post('/api/sessions/:id/store-tests', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  try {
    res.json(await runStoreTests(req.params.id, req.body?.targets));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Store tests failed' });
  }
});

app.get('/api/sessions/:id/scan', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  try {
    res.json(await scanWorkspace(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Scan failed' });
  }
});

app.post('/api/sessions/:id/autofix', async (req, res) => {
  if (!(await ownedSession(req, res))) return;
  try {
    res.json(await fixWorkspace(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Auto-fix failed' });
  }
});

await init();
await initAuth();

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    closeAllDesktops().finally(() => process.exit(0));
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orbit API listening on http://0.0.0.0:${PORT}`);
  console.log(`Engine: Orbit 1.2 · ${MODEL.remote} (locked)`);
  reapOrphanDesktops().then((killed) => {
    if (killed) console.log(`Closed ${killed} leftover desktop sandbox${killed === 1 ? '' : 'es'}`);
  });
});

attachBrowserSocket(server);
