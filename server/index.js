import express from 'express';
import archiver from 'archiver';
import path from 'node:path';
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
} from './store.js';
import { runAgent } from './agent.js';
import { MODELS, hasGroqKey } from './groq.js';
import { detectPlatform } from './platform.js';

const app = express();
const PORT = Number(process.env.PORT || 8000);

app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/models', (req, res) => {
  res.json({ models: MODELS, default: MODELS[0].id, groqConfigured: hasGroqKey() });
});

app.get('/api/platform', (req, res) => {
  res.json(detectPlatform(req.headers));
});

let integrationCache = { at: 0, data: null };

async function probeGitHub() {
  if (!process.env.GITHUB_TOKEN) return { connected: false, readOnly: true };
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) return { connected: false, error: `Token rejected (${res.status})` };
    const user = await res.json();
    return { connected: true, login: user.login, avatar: user.avatar_url };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function probeHuggingFace() {
  if (!process.env.HF_TOKEN) return { connected: false };
  try {
    const res = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
    });
    if (!res.ok) return { connected: false, error: `Token rejected (${res.status})` };
    const data = await res.json();
    return { connected: true, name: data.name || data.fullname };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

app.get('/api/integrations', async (req, res) => {
  if (integrationCache.data && Date.now() - integrationCache.at < 30_000) {
    return res.json(integrationCache.data);
  }
  const [github, huggingface] = await Promise.all([probeGitHub(), probeHuggingFace()]);
  const data = {
    groq: { connected: hasGroqKey() },
    github,
    huggingface,
  };
  integrationCache = { at: Date.now(), data };
  res.json(data);
});

app.get('/api/sessions', async (req, res) => {
  res.json({ sessions: await listSessions() });
});

app.post('/api/sessions', async (req, res) => {
  const session = await createSession({
    title: req.body?.title || 'New session',
    model: req.body?.model || MODELS[0].id,
  });
  res.status(201).json({ session });
});

app.get('/api/sessions/:id', async (req, res) => {
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const [messages, files] = await Promise.all([
    getMessages(req.params.id),
    listWorkspaceFiles(req.params.id),
  ]);
  res.json({ session, messages, files });
});

app.patch('/api/sessions/:id', async (req, res) => {
  const session = await updateSession(req.params.id, {
    ...(req.body?.title !== undefined ? { title: req.body.title } : {}),
    ...(req.body?.model !== undefined ? { model: req.body.model } : {}),
  });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

app.delete('/api/sessions/:id', async (req, res) => {
  await deleteSession(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sessions/:id/workspace', async (req, res) => {
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ files: await listWorkspaceFiles(req.params.id) });
});

app.get('/api/sessions/:id/file', async (req, res) => {
  try {
    const content = await readWorkspaceFile(req.params.id, String(req.query.path || ''));
    res.json({ path: req.query.path, content });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/export.zip', async (req, res) => {
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

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
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const message = String(req.body?.message || '').trim();
  const model = req.body?.model || session.model;
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

  try {
    await addMessage(req.params.id, { role: 'user', content: message });

    if (session.title === 'New session' || !session.title) {
      const title = message.replace(/\s+/g, ' ').slice(0, 60);
      await updateSession(req.params.id, { title, model });
    } else if (model !== session.model) {
      await updateSession(req.params.id, { model });
    }

    emit({ type: 'user_saved', message });

    await runAgent({
      sessionId: req.params.id,
      model,
      signal: controller.signal,
      emit,
    });
  } catch (error) {
    if (error.name !== 'AbortError') {
      emit({ type: 'error', message: error.message || 'Agent failed' });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});

await init();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Forge API listening on http://0.0.0.0:${PORT}`);
  console.log(`Groq key: ${hasGroqKey() ? 'configured' : 'MISSING'}`);
});
