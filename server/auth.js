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
const SECRET_FILE = path.join(DATA_DIR, 'session-secret');

export const SESSION_COOKIE = 'orbit_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let users = [];
let secret = '';

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
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

/** Session tokens are signed, not stored: a restart can never sign anyone out. */
function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

const hashPassword = async (password, salt) =>
  (await scrypt(password, salt, 64)).toString('hex');

const publicUser = (user) =>
  user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        onboarded_at: user.onboarded_at || null,
      }
    : null;

export async function initAuth() {
  await mkdir(DATA_DIR, { recursive: true });
  users = await readJson(USERS_FILE, []);
  secret = await readFile(SECRET_FILE, 'utf8').catch(() => '');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    await writeFile(SECRET_FILE, secret, { mode: 0o600 });
  }
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
    onboarded_at: null,
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
  const payload = `${userId}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Signed tokens cannot be revoked server-side; signing out clears the cookie. */
export async function revokeToken() {}

export function userForToken(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const expected = sign(`${userId}.${expires}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expires) < Date.now()) return null;
  return publicUser(users.find((user) => user.id === userId));
}

/** Marks the account as having seen the welcome tour. */
export async function completeOnboarding(userId) {
  const user = users.find((entry) => entry.id === userId);
  if (!user) return null;
  if (!user.onboarded_at) {
    user.onboarded_at = new Date().toISOString();
    await persist();
  }
  return publicUser(user);
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
