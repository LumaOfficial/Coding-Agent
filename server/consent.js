import { randomUUID } from 'node:crypto';

/**
 * Consent gate. Anything with a real side effect outside the workspace — a
 * GitHub write, a delete, a shell command — asks the user first through a card
 * in the chat and only runs when they allow it. Reads and normal file writes
 * never ask.
 */

const pending = new Map();
const CONSENT_MS = 3 * 60 * 1000;

/** The chat answered a consent card. */
export function resolveConsent(id, approved) {
  const entry = pending.get(id);
  if (!entry) return false;
  pending.delete(id);
  clearTimeout(entry.timer);
  entry.resolve(Boolean(approved));
  return true;
}

/**
 * Show the card and wait. Resolves true only when the user pressed Allow;
 * a decline or a timeout resolves false.
 */
export function requestConsent(ctx, request) {
  if (!ctx?.emit) return Promise.resolve(false);
  const id = randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(false);
    }, CONSENT_MS);
    timer.unref?.();
    pending.set(id, { resolve, timer });
    ctx.emit({
      type: 'consent_request',
      id,
      action: request.action,
      title: request.title,
      summary: request.summary || '',
      detail: request.detail || '',
      risk: request.risk || 'write',
    });
  });
}

/** Stop waiting on cards from a chat that went away. */
export function cancelConsents() {
  for (const [id, entry] of [...pending]) {
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(false);
  }
}

/** What a tool returns to the model when the user said no. */
export function declined(action) {
  return {
    ok: false,
    content: `The user declined this ${action}. Do not retry it — ask what they would prefer instead.`,
  };
}
