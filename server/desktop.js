/**
 * Forge's own computer. Each chat session can own one E2B desktop sandbox —
 * an isolated Linux (Xfce) machine with Chromium, a terminal and a mouse.
 *
 * Credits are the scarce resource, so a sandbox never outlives its usefulness:
 *  - it is created with a 3 minute sandbox timeout, so E2B kills it even if
 *    this server dies;
 *  - every tool use extends that timeout and resets a local 3 minute idle timer;
 *  - deleting a session, starting a new chat or the agent calling desktop_close
 *    kills it immediately.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
export const screenshotDir = path.join(DATA_DIR, 'desktop-shots');

export const IDLE_MS = 3 * 60 * 1000;

const desktops = new Map();

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = import('@e2b/desktop');
  return sdkPromise;
}

export function desktopConfigured() {
  return Boolean(process.env.E2B_API_KEY);
}

export function desktopStatus() {
  return {
    configured: desktopConfigured(),
    active: desktops.size,
    idleTimeoutMs: IDLE_MS,
  };
}

function scheduleIdleKill(sessionId, entry) {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    closeDesktop(sessionId, 'idle');
  }, IDLE_MS);
  entry.timer.unref?.();
}

async function createEntry(sessionId) {
  if (!desktopConfigured()) {
    throw new Error('Forge has no computer yet — add E2B_API_KEY in the app secrets.');
  }
  const { Sandbox } = await loadSdk();
  const sandbox = await Sandbox.create({ timeoutMs: IDLE_MS });
  return {
    sandbox,
    timer: null,
    lastUsed: Date.now(),
    state: { chrome: false },
  };
}

async function getEntry(sessionId) {
  let entry = desktops.get(sessionId);
  if (!entry) {
    entry = await createEntry(sessionId);
    desktops.set(sessionId, entry);
  }
  return entry;
}

/**
 * Run `fn(sandbox, state)` against this session's desktop, creating it on
 * first use and keeping it alive for another 3 minutes of work.
 */
export async function withDesktop(sessionId, fn) {
  const entry = await getEntry(sessionId);
  entry.lastUsed = Date.now();
  try {
    return await fn(entry.sandbox, entry.state);
  } finally {
    entry.lastUsed = Date.now();
    if (desktops.get(sessionId) === entry) {
      scheduleIdleKill(sessionId, entry);
      try {
        await entry.sandbox.setTimeout?.(IDLE_MS);
      } catch {
        /* older sandbox — the local idle timer still kills it */
      }
    }
  }
}

export async function closeDesktop(sessionId) {
  const entry = desktops.get(sessionId);
  if (!entry) return false;
  desktops.delete(sessionId);
  clearTimeout(entry.timer);
  try {
    await entry.sandbox.kill();
  } catch {
    /* already gone */
  }
  return true;
}

export async function closeAllDesktops() {
  await Promise.all([...desktops.keys()].map((id) => closeDesktop(id)));
}

/** Store a PNG and return the URL the chat and the model can use. */
export async function saveScreenshot(sessionId, image) {
  const dir = path.join(screenshotDir, sessionId);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.png`;
  const bytes = Buffer.from(image);
  await writeFile(path.join(dir, name), bytes);
  return { url: `/api/desktop/screenshots/${sessionId}/${name}`, bytes: bytes.length };
}
