import { mkdir, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2));
}

const sessionDir = (id) => path.join(SESSIONS_DIR, id);
const metaFile = (id) => path.join(sessionDir(id), 'meta.json');
const messagesFile = (id) => path.join(sessionDir(id), 'messages.json');
export const workspaceDir = (id) => path.join(sessionDir(id), 'workspace');

export async function init() {
  await mkdir(SESSIONS_DIR, { recursive: true });
}

export async function listSessions() {
  let ids = [];
  try {
    ids = await readdir(SESSIONS_DIR);
  } catch {
    return [];
  }
  const sessions = await Promise.all(
    ids.map(async (id) => {
      const meta = await readJson(metaFile(id), null);
      if (!meta) return null;
      const messages = await readJson(messagesFile(id), []);
      return { ...meta, messageCount: messages.length };
    })
  );
  return sessions
    .filter(Boolean)
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export async function createSession({ title = 'New session', model = 'cloudflare/gemma-4-26b-a4b-instruct' } = {}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const meta = { id, title, model, created_at: now, updated_at: now };
  await mkdir(workspaceDir(id), { recursive: true });
  await writeJson(metaFile(id), meta);
  await writeJson(messagesFile(id), []);
  return meta;
}

export async function getSession(id) {
  return readJson(metaFile(id), null);
}

export async function updateSession(id, patch) {
  const meta = await getSession(id);
  if (!meta) return null;
  const next = { ...meta, ...patch, id, updated_at: new Date().toISOString() };
  await writeJson(metaFile(id), next);
  return next;
}

export async function deleteSession(id) {
  await rm(sessionDir(id), { recursive: true, force: true });
}

export async function getMessages(id) {
  return readJson(messagesFile(id), []);
}

export async function addMessage(id, message) {
  const messages = await getMessages(id);
  const entry = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...message,
  };
  messages.push(entry);
  await writeJson(messagesFile(id), messages);
  await updateSession(id, {});
  return entry;
}

/* ---------------- workspace files ---------------- */

function safePath(root, rel) {
  const clean = String(rel || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const full = path.resolve(root, clean);
  if (!full.startsWith(path.resolve(root) + path.sep) && full !== path.resolve(root)) {
    throw new Error(`Invalid path: ${rel}`);
  }
  return full;
}

export async function writeWorkspaceFile(sessionId, relPath, content) {
  const root = workspaceDir(sessionId);
  const full = safePath(root, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content ?? '');
  return relPath.replace(/^\/+/, '');
}

export async function readWorkspaceFile(sessionId, relPath) {
  const root = workspaceDir(sessionId);
  return readFile(safePath(root, relPath), 'utf8');
}

export async function deleteWorkspaceFile(sessionId, relPath) {
  const root = workspaceDir(sessionId);
  await rm(safePath(root, relPath), { recursive: true, force: true });
}

export async function listWorkspaceFiles(sessionId) {
  const root = workspaceDir(sessionId);
  const out = [];
  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const info = await stat(full);
        out.push({
          path: path.relative(root, full).split(path.sep).join('/'),
          size: info.size,
        });
      }
    }
  }
  await walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
