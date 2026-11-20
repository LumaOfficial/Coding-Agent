import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Account + session auth for Orbit.
 *
 * Users and their long-lived session tokens live in the DATA_DIR volume, so
 * accounts survive restarts. Passwords are hashed with scrypt; the browser only
 * ever holds an httpOnly cookie (30 days), which is what "remember me" means
 * here — reopen the app and you are still signed in.
 */

const scrypt = promisify(crypto.scrypt);

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TOKENS_FILE = path.join(DATA_DIR, 'auth-tokens.json');

export const SESSION_COOKIE = 'orbit_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let users = [];
let tokens = {};

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function persist() {
  await Promise.all([
    writeFile(USERS_FILE, JSON.stringify(users, null, 2)),
    writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2)),
  ]);
}

const hashPassword = async (password, salt) =>
  (await scrypt(password, salt, 64)).toString('hex');

const publicUser = (user) =>
  user ? { id: user.id, email: user.email, name: user.name, created_at: user.created_at } : null;

export async function initAuth() {
  await mkdir(DATA_DIR, { recursive: true });
  users = await readJson(USERS_FILE, []);
  tokens = await readJson(TOKENS_FILE, {});

  const now = Date.now();
  let changed = false;
  for (const [token, entry] of Object.entries(tokens)) {
    if (!entry || entry.expires_at < now || !users.some((u) => u.id === entry.user_id)) {
      delete tokens[token];
      changed = true;
    }
  }
  if (changed) await persist();
}

export async function signUp({ email, password, name }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw httpError(400, 'Enter a valid email address.');
  }
  if (String(password || '').length < 8) {
    throw httpError(400, 'Password must be at least 8 characters.');
  }
  if (users.some((user) => user.email === cleanEmail)) {
    throw httpError(409, 'An account with that email already exists. Sign in instead.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: crypto.randomUUID(),
    email: cleanEmail,
    name: String(name || '').trim().slice(0, 60) || cleanEmail.split('@')[0],
    salt,
    password_hash: await hashPassword(password, salt),
    created_at: new Date().toISOString(),
  };
  users.push(user);
  await persist();
  return publicUser(user);
}

export async function signIn({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const user = users.find((entry) => entry.email === cleanEmail);
  if (!user) throw httpError(401, 'Email or password is incorrect.');

  const candidate = await hashPassword(String(password || ''), user.salt);
  const expected = Buffer.from(user.password_hash, 'hex');
  const actual = Buffer.from(candidate, 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw httpError(401, 'Email or password is incorrect.');
  }
  return publicUser(user);
}

export async function issueToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  tokens[token] = { user_id: userId, created_at: now, expires_at: now + SESSION_TTL_MS };
  await persist();
  return token;
}

export async function revokeToken(token) {
  if (!token || !tokens[token]) return;
  delete tokens[token];
  await persist();
}

export function userForToken(token) {
  const entry = token ? tokens[token] : null;
  if (!entry || entry.expires_at < Date.now()) return null;
  return publicUser(users.find((user) => user.id === entry.user_id));
}

export function readSessionToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

const PUBLIC_PATHS = new Set(['/health', '/auth/signup', '/auth/login', '/auth/me', '/auth/logout']);

/** Mounted at /api: attaches req.user and rejects unauthenticated calls. */
export function apiAuth(req, res, next) {
  req.user = userForToken(readSessionToken(req));
  if (req.user || PUBLIC_PATHS.has(req.path)) return next();
  return res.status(401).json({ error: 'Sign in to continue.' });
}
