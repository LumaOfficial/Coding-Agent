import { browserCommand } from '../browser.js';
import { saveScreenshot } from '../desktop.js';

/**
 * Browser tools — Orbit works in the user's own browser through the Orbit
 * extension. Anything that changes the page needs the user's approval, which
 * arrives as a card in the chat before the extension runs the command.
 */

function denied(text) {
  const error = new Error(text);
  error.declined = true;
  return error;
}

async function run(ctx, action, params, { summary, detail, url, needsApproval = true }) {
  const result = await browserCommand(ctx.sessionId, {
    action,
    params,
    summary,
    detail,
    url,
    needsApproval,
  });

  if (result.denied) {
    throw denied(
      `${result.text} Do not retry the same action — ask the user what they would prefer.`
    );
  }
  if (!result.ok) throw new Error(result.text || 'The browser could not run that.');

  const lines = [result.text || 'Done.'];
  if (result.title) lines.push(`Page: ${result.title}`);
  if (result.url) lines.push(`URL: ${result.url}`);

  if (result.image) {
    if (typeof result.image === 'string' && result.image.startsWith('data:image')) {
      try {
        const base64 = result.image.split(',')[1] || '';
        const saved = await saveScreenshot(ctx.sessionId, Buffer.from(base64, 'base64'));
        lines.push(`Screenshot: ${saved.url}`);
      } catch {
        /* the model still gets the image */
      }
    }
    return { text: lines.join('\n'), image: result.image };
  }
  return lines.join('\n');
}

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'browser_tabs',
      description:
        "List the tabs open in the user's browser (title, URL, which one is active). Read-only — no approval needed.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_snapshot',
      description:
        "Read the page the user has open in their browser: title, URL, visible text and a numbered list of clickable/typable elements. Read-only. Always call this before clicking or typing so you act on what is really there.",
      parameters: {
        type: 'object',
        properties: {
          max_text: { type: 'number', description: 'Characters of page text to return. Default 4000.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description:
        "Look at the page in the user's browser and get a screenshot back as an image. Read-only — no approval needed.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_open',
      description:
        "Navigate the user's browser tab to a URL. Needs the user's approval — they see a card and approve or decline before it runs.",
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Absolute http(s) URL to open.' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description:
        "Click an element on the page in the user's browser. Give a CSS selector, the visible text of the element, or the index from browser_snapshot. Needs approval; the user watches Orbit's cursor move to the element.",
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element.' },
          text: { type: 'string', description: 'Visible text or aria-label of the element.' },
          index: { type: 'number', description: 'Index from the last browser_snapshot.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_type',
      description:
        "Type text into a field on the page in the user's browser (input, textarea or contenteditable). Needs approval; the user watches it type. Set enter to true to press Enter afterwards.",
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to type.' },
          selector: { type: 'string', description: 'CSS selector of the field.' },
          label: { type: 'string', description: 'Visible label or placeholder of the field.' },
          index: { type: 'number', description: 'Index from the last browser_snapshot.' },
          enter: { type: 'boolean', description: 'Press Enter after typing.' },
          clear: { type: 'boolean', description: 'Clear the field first. Default true.' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_key',
      description:
        "Press a key or key combination in the user's browser, e.g. Enter, Tab, Escape, or Ctrl+L. Needs approval.",
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Key name, e.g. "Enter" or "a".' },
          ctrl: { type: 'boolean', description: 'Hold Ctrl (or Cmd on macOS).' },
          shift: { type: 'boolean', description: 'Hold Shift.' },
          alt: { type: 'boolean', description: 'Hold Alt.' },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_scroll',
      description:
        "Scroll the page in the user's browser. Needs approval.",
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['down', 'up', 'top', 'bottom'], description: 'Where to scroll. Default down.' },
          amount: { type: 'number', description: 'Pixels to scroll. Default 700.' },
        },
      },
    },
  },
];

export const handlers = {
  browser_tabs: (args, ctx) =>
    run(ctx, 'tabs', {}, { summary: 'Listing your open tabs', needsApproval: false }),

  browser_snapshot: (args, ctx) =>
    run(
      ctx,
      'snapshot',
      { max_text: Math.min(Math.max(Number(args.max_text) || 4000, 500), 12000) },
      { summary: 'Reading the page in your browser', needsApproval: false }
    ),

  browser_screenshot: (args, ctx) =>
    run(ctx, 'screenshot', {}, { summary: 'Looking at your browser tab', needsApproval: false }),

  browser_open: (args, ctx) =>
    run(
      ctx,
      'open',
      { url: String(args.url || '') },
      {
        summary: `Opening ${args.url} in your browser`,
        detail: 'This navigates the tab you have open.',
        url: String(args.url || ''),
      }
    ),

  browser_click: (args, ctx) =>
    run(
      ctx,
      'click',
      {
        selector: args.selector || '',
        text: args.text || '',
        index: Number.isFinite(Number(args.index)) ? Number(args.index) : null,
      },
      {
        summary: `Clicking ${args.text || args.selector || (args.index != null ? `element #${args.index}` : 'an element')} in your browser`,
        detail: 'Orbit moves its cursor to the element and clicks it.',
      }
    ),

  browser_type: (args, ctx) =>
    run(
      ctx,
      'type',
      {
        text: String(args.text ?? ''),
        selector: args.selector || '',
        label: args.label || '',
        index: Number.isFinite(Number(args.index)) ? Number(args.index) : null,
        enter: Boolean(args.enter),
        clear: args.clear !== false,
      },
      {
        summary: `Typing into ${args.label || args.selector || 'the focused field'} in your browser`,
        detail: `Text: ${String(args.text ?? '').slice(0, 120)}`,
      }
    ),

  browser_key: (args, ctx) =>
    run(
      ctx,
      'key',
      {
        key: String(args.key || 'Enter'),
        ctrl: Boolean(args.ctrl),
        shift: Boolean(args.shift),
        alt: Boolean(args.alt),
      },
      { summary: `Pressing ${args.key || 'a key'} in your browser`, detail: 'Keyboard input in the focused tab.' }
    ),

  browser_scroll: (args, ctx) =>
    run(
      ctx,
      'scroll',
      { direction: args.direction || 'down', amount: Number(args.amount) || 700 },
      { summary: `Scrolling ${args.direction || 'down'} in your browser`, detail: 'Moves the page.' }
    ),
};
