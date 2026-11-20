/**
 * Desktop tools — Orbit drives its own E2B Linux machine: Chromium, mouse,
 * keyboard, a shell and screenshots. Handlers return { text, image } so the
 * agent can look at the screen right after acting on it.
 */

import { closeDesktop, saveScreenshot, withDesktop, IDLE_MS } from '../desktop.js';

const LAUNCH = 'google-chrome';

function idleNote() {
  return `The computer closes itself after ${Math.round(IDLE_MS / 60000)} minutes idle.`;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function dataUrl(image) {
  return `data:image/png;base64,${Buffer.from(image).toString('base64')}`;
}

async function shot(sessionId, sandbox) {
  const image = await sandbox.screenshot();
  const saved = await saveScreenshot(sessionId, image);
  return { image: dataUrl(image), saved };
}

async function settleTitle(sandbox, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let title = '';
  while (Date.now() < deadline) {
    title = await windowTitle(sandbox);
    if (title && title !== 'Xfwm4' && !/^New Tab/.test(title)) return title;
    await sandbox.wait(700);
  }
  return title;
}

async function windowTitle(sandbox) {
  try {
    const id = await sandbox.getCurrentWindowId();
    return (await sandbox.getWindowTitle(id)) || '';
  } catch {
    return '';
  }
}

/**
 * Open a URL by starting Chromium from the shell on the desktop display.
 * Keystroke navigation (ctrl+l) depends on window focus and misses right
 * after launch, while passing the URL to Chromium always loads it.
 */
async function openUrl(sandbox, url) {
  const quoted = `'${String(url).replace(/'/g, `'\\''`)}'`;
  await sandbox.commands.run(`DISPLAY=:0 ${LAUNCH} --no-first-run ${quoted} >/dev/null 2>&1 &`, {
    background: true,
  });
}

function screenshotLine(saved) {
  return `Screenshot: ${saved.url}`;
}

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'desktop_launch',
      description:
        'Start Orbit\'s own isolated Linux desktop (E2B) and open an app in it, Chromium by default. Call this before driving a website. Returns a screenshot of the screen.',
      parameters: {
        type: 'object',
        properties: {
          app: {
            type: 'string',
            description: 'Application to open. Default google-chrome.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_navigate',
      description:
        'Open a URL in Chromium on Orbit\'s desktop (launches Chromium if needed) and return the page title plus a screenshot of what is on screen.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full http(s) URL to open.' },
          wait_ms: {
            type: 'number',
            description: 'How long to let the page load, 500–15000. Default 3000.',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_click',
      description:
        'Click at pixel coordinates on Orbit\'s desktop and return a screenshot. Coordinates are in the screenshot you last received (top-left is 0,0).',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'Horizontal pixel.' },
          y: { type: 'number', description: 'Vertical pixel.' },
          button: {
            type: 'string',
            enum: ['left', 'right', 'double'],
            description: 'Which click. Default left.',
          },
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_type',
      description:
        'Type text into whatever has focus on Orbit\'s desktop, optionally pressing Enter afterwards (useful for search boxes and forms).',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to type.' },
          press_enter: { type: 'boolean', description: 'Press Enter after typing.' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_key',
      description:
        'Press a key or key combination on Orbit\'s desktop, e.g. "enter", "tab", ["ctrl", "l"] to focus the address bar, ["ctrl", "t"] for a new tab.',
      parameters: {
        type: 'object',
        properties: {
          keys: {
            type: 'string',
            description: 'One key, or a "+" joined combination such as "ctrl+shift+r".',
          },
        },
        required: ['keys'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_terminal',
      description:
        'Run a bash command inside Orbit\'s desktop VM (Ubuntu, node, python, git available) and get stdout, stderr and the exit code. Use it to install packages, run a test suite or inspect the VM.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Bash command to run.' },
          cwd: { type: 'string', description: 'Working directory. Default /home/user.' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_screenshot',
      description:
        'Capture what is on Orbit\'s desktop right now. Use it to check the result of an action, confirm a page rendered, or inspect an error on screen.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_close',
      description:
        'Shut down Orbit\'s desktop immediately and stop its credit usage. Call it when you are done with the computer.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export const handlers = {
  async desktop_launch(args, ctx) {
    const app = String(args?.app || LAUNCH).trim() || LAUNCH;
    return withDesktop(ctx.sessionId, async (sandbox, state) => {
      await sandbox.launch(app);
      await sandbox.wait(2000);
      if (app === LAUNCH) state.chrome = true;
      const title = await windowTitle(sandbox);
      const { image, saved } = await shot(ctx.sessionId, sandbox);
      return {
        text: `Opened ${app} on Orbit's desktop.${title ? `\nWindow: ${title}` : ''}\n${screenshotLine(saved)}\n${idleNote()}`,
        image,
      };
    });
  },

  async desktop_navigate(args, ctx) {
    const raw = String(args?.url || '').trim();
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Not a valid URL: ${raw}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only http and https pages can be opened.');
    }
    const waitMs = clampInt(args?.wait_ms, 500, 15000, 3000);

    return withDesktop(ctx.sessionId, async (sandbox, state) => {
      await openUrl(sandbox, url.href);
      state.chrome = true;
      await sandbox.wait(waitMs);
      const title = await settleTitle(sandbox);
      const { image, saved } = await shot(ctx.sessionId, sandbox);
      return {
        text: `Chromium is on ${url.href}${title ? `\nWindow: ${title}` : ''}\n${screenshotLine(saved)}`,
        image,
      };
    });
  },

  async desktop_click(args, ctx) {
    const x = clampInt(args?.x, 0, 5000, null);
    const y = clampInt(args?.y, 0, 5000, null);
    if (x === null || y === null) throw new Error('desktop_click needs numeric x and y.');
    const button = String(args?.button || 'left');

    return withDesktop(ctx.sessionId, async (sandbox) => {
      if (button === 'right') await sandbox.rightClick(x, y);
      else if (button === 'double') await sandbox.doubleClick(x, y);
      else await sandbox.leftClick(x, y);
      await sandbox.wait(1200);
      const title = await windowTitle(sandbox);
      const { image, saved } = await shot(ctx.sessionId, sandbox);
      return {
        text: `${button === 'double' ? 'Double-clicked' : `Clicked ${button}`} (${x}, ${y}).${
          title ? `\nWindow: ${title}` : ''
        }\n${screenshotLine(saved)}`,
        image,
      };
    });
  },

  async desktop_type(args, ctx) {
    const text = String(args?.text ?? '');
    if (!text) throw new Error('desktop_type needs text.');
    return withDesktop(ctx.sessionId, async (sandbox) => {
      await sandbox.write(text);
      if (args?.press_enter) {
        await sandbox.wait(200);
        await sandbox.press('enter');
      }
      await sandbox.wait(600);
      return `Typed ${text.length} characters${args?.press_enter ? ' and pressed Enter' : ''}.`;
    });
  },

  async desktop_key(args, ctx) {
    const raw = String(args?.keys || '').trim();
    if (!raw) throw new Error('desktop_key needs keys.');
    const keys = raw.includes('+') ? raw.split('+').map((k) => k.trim()).filter(Boolean) : raw;
    return withDesktop(ctx.sessionId, async (sandbox) => {
      await sandbox.press(keys);
      await sandbox.wait(600);
      return `Pressed ${Array.isArray(keys) ? keys.join('+') : keys}.`;
    });
  },

  async desktop_terminal(args, ctx) {
    const command = String(args?.command || '').trim();
    if (!command) throw new Error('desktop_terminal needs a command.');
    const cwd = String(args?.cwd || '/home/user');

    return withDesktop(ctx.sessionId, async (sandbox) => {
      const out = await sandbox.commands.run(command, { cwd, timeoutMs: 120_000 });
      const stdout = String(out?.stdout || '').trim();
      const stderr = String(out?.stderr || '').trim();
      const exit = out?.exitCode ?? 0;
      const body = [
        `$ ${command}`,
        stdout || '(no stdout)',
        stderr ? `stderr:\n${stderr}` : '',
        `exit ${exit}`,
      ]
        .filter(Boolean)
        .join('\n');
      return body;
    });
  },

  async desktop_screenshot(args, ctx) {
    return withDesktop(ctx.sessionId, async (sandbox) => {
      const title = await windowTitle(sandbox);
      const { image, saved } = await shot(ctx.sessionId, sandbox);
      return {
        text: `Desktop screenshot (${Math.round(saved.bytes / 1024)} KB)${title ? ` · ${title}` : ''}\n${screenshotLine(saved)}`,
        image,
      };
    });
  },

  async desktop_close(args, ctx) {
    const closed = await closeDesktop(ctx.sessionId);
    return closed
      ? 'Orbit\'s desktop is shut down — no more credits are being used.'
      : 'No desktop was running, so there was nothing to shut down.';
  },
};
