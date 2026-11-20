import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

/**
 * Orbit's browser bridge. A small extension connects here and runs the
 * commands the agent asks for in the user's own tab. Anything that changes
 * the page (navigate, click, type, key, scroll) is held until the user
 * approves it in the chat — reads (snapshot, screenshot, tabs) go straight
 * through.
 */

const clients = new Set();
const subscribers = new Map();
const pending = new Map();

const APPROVAL_MS = 3 * 60 * 1000;
const EXEC_MS = 90 * 1000;

export function subscribeSession(sessionId, emit) {
  let set = subscribers.get(sessionId);
  if (!set) {
    set = new Set();
    subscribers.set(sessionId, set);
  }
  set.add(emit);
  return () => {
    set.delete(emit);
    if (!set.size) subscribers.delete(sessionId);
  };
}

function publish(sessionId, payload) {
  const set = subscribers.get(sessionId);
  if (!set) return;
  for (const emit of [...set]) {
    try {
      emit(payload);
    } catch {
      /* stream already closed */
    }
  }
}

export function browserStatus() {
  return { connected: clients.size > 0, clients: clients.size };
}

function send(socket, payload) {
  if (socket?.readyState === 1) socket.send(JSON.stringify(payload));
}

function settle(id, value) {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  clearTimeout(entry.timer);
  entry.resolve(value);
}

function liveSocket() {
  for (const socket of clients) {
    if (socket.readyState === 1) return socket;
  }
  return null;
}

/** Keep the bridge alive; drop sockets the extension abandoned. */
export function attachBrowserSocket(server) {
  const wss = new WebSocketServer({ server, path: '/browser/ws' });

  wss.on('connection', (socket) => {
    clients.add(socket);
    send(socket, { type: 'hello', app: 'orbit' });

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message.type === 'result') {
        settle(message.id, {
          ok: message.ok !== false,
          text: message.text || '',
          image: message.image || null,
          url: message.url || '',
          title: message.title || '',
        });
      }
    });

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  const ping = setInterval(() => {
    for (const socket of clients) {
      if (socket.readyState !== 1) {
        clients.delete(socket);
        continue;
      }
      try {
        socket.ping();
      } catch {
        clients.delete(socket);
      }
    }
  }, 25000);
  ping.unref?.();

  return wss;
}

/** The chat answered an approval card. */
export function resolveApproval(id, approved) {
  const entry = pending.get(id);
  if (!entry) return false;

  if (!approved) {
    settle(id, {
      ok: false,
      denied: true,
      text: 'The user declined this browser action.',
    });
    return true;
  }

  const socket = liveSocket();
  if (!socket) {
    settle(id, {
      ok: false,
      text: 'The browser extension disconnected — reconnect it and try again.',
    });
    return true;
  }

  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    settle(id, { ok: false, text: 'The browser did not answer in time.' });
  }, EXEC_MS);
  send(socket, {
    type: 'execute',
    id,
    action: entry.command.action,
    params: entry.command.params || {},
  });
  return true;
}

/** Drop everything waiting on a chat that went away. */
export function cancelSession(sessionId) {
  for (const [id, entry] of [...pending]) {
    if (entry.sessionId !== sessionId) continue;
    settle(id, { ok: false, text: 'The chat was stopped before this finished.' });
  }
}

export async function browserCommand(sessionId, command) {
  if (!clients.size) {
    return {
      ok: false,
      text: "Orbit's browser extension isn't connected. Open the extension popup, point it at this app's API and connect — then ask again.",
    };
  }

  const id = randomUUID();
  return new Promise((resolve) => {
    pending.set(id, { id, resolve, command, sessionId, timer: null });

    if (!command.needsApproval) {
      resolveApproval(id, true);
      return;
    }

    publish(sessionId, {
      type: 'browser_request',
      id,
      action: command.action,
      summary: command.summary,
      detail: command.detail || '',
      url: command.url || '',
    });

    const entry = pending.get(id);
    if (entry) {
      entry.timer = setTimeout(() => {
        settle(id, {
          ok: false,
          denied: true,
          text: 'No approval within 3 minutes — the browser action was cancelled.',
        });
      }, APPROVAL_MS);
    }
  });
}
