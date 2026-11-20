import { getMessages, addMessage, getSession, listWorkspaceFiles } from './store.js';
import { executeTool } from './tools/index.js';
import { chatCompletion, configStatus } from './cloudflare.js';

/**
 * Orbit agent. Every turn runs on Orbit 1.2, which calls the local tool
 * registry (workspace, GitHub, Hugging Face, VS Code, platform, autofix,
 * stores). No other model is available.
 */

const MAX_STEPS = 12;
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `You are Orbit, a coding agent working inside the user's workspace.

Rules:
- You have your own computer with internet access: use web_search to look things up and web_fetch to open a page and read it. Prefer official docs over guessing.
- Web workflow: call web_search once (a second time only with different words), then web_fetch the best result. Never repeat the same search, and answer once you have read a page.
- Use the tools to inspect and change files. Never invent file contents.
- write_file always takes the complete file, not a fragment.
- After changing code, call autofix_workspace and fix whatever it reports.
- test_store_readiness checks a project against app stores; use it when asked about submission.
- You can also work in the user's own browser through the Orbit extension: browser_snapshot and browser_screenshot are read-only, while browser_open, browser_click, browser_type, browser_key and browser_scroll show the user an approval card first and only run if they approve. Snapshot before acting, do one action at a time, and if the user declines, ask what they would prefer instead of retrying.
- Anything with a real side effect shows the user a consent card first and only runs if they press Allow: deleting a workspace file, overwriting an existing one, committing to GitHub, opening a branch or pull request, and running a shell command on your own computer. If they decline, do not retry — ask what they would prefer.
- You also have your own isolated Linux computer (E2B desktop) with Chromium. Use it to check or test something yourself instead of guessing: desktop_navigate to open a URL, desktop_screenshot to look at the screen, desktop_click (pixel coordinates from the screenshot) and desktop_type/desktop_key to interact, desktop_terminal to run shell commands inside the VM, desktop_close when you are done. Screenshots come back to you as images — read them before the next click.
- The desktop shuts itself down after 3 minutes of inactivity, so batch your steps and call desktop_close when finished.
- GitHub and Hugging Face tools are read-only without a token.
- Every catalog platform is usable without a token: list_platforms shows whether it is reached through its public API (platform_request) or the agent's own browser (web_fetch / desktop_navigate). Never ask the user for an API token; fall back to the browser path instead.
- Answer in short markdown: what you did, then the result. No preamble, no filler.`;

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Keep only the newest screenshot so image tokens never pile up. */
function pruneImages(messages) {
  const hasImage = (m) =>
    Array.isArray(m.content) && m.content.some((part) => part?.type === 'image_url');
  const imageIndexes = messages.map((m, i) => (hasImage(m) ? i : -1)).filter((i) => i >= 0);
  if (imageIndexes.length <= 1) return messages;
  const keep = imageIndexes[imageIndexes.length - 1];
  return messages.filter((m, i) => !hasImage(m) || i === keep);
}

function buildHistory(messages) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content || '' }))
    .filter((message) => message.content.trim())
    .slice(-HISTORY_LIMIT);
}

async function persistTurn(sessionId, content, executed) {
  await addMessage(sessionId, {
    role: 'assistant',
    content,
    tool_calls: executed.map((call) => ({
      id: call.id,
      name: call.name,
      arguments: JSON.stringify(call.args),
    })),
  });
  for (const call of executed) {
    await addMessage(sessionId, {
      role: 'tool',
      tool_call_id: call.id,
      name: call.name,
      content: call.content,
    });
  }
}

async function finish(sessionId, emit, content, executed = []) {
  await persistTurn(sessionId, content, executed);
  emit({ type: 'text', delta: content });
  emit({ type: 'done' });
}

export async function runAgent({ sessionId, emit }) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const { configured, missing } = configStatus();
  if (!configured) {
    const note = `**Orbit's engine is not connected.**\n\nAdd ${missing
      .map((key) => `\`${key}\``)
      .join(' and ')} in the app secrets, then send the message again.`;
    await finish(sessionId, emit, note);
    return;
  }

  const messages = await getMessages(sessionId);
  const files = await listWorkspaceFiles(sessionId).catch(() => []);
  const fileList =
    files
      .slice(0, 60)
      .map((file) => `- ${file.path} (${file.size} B)`)
      .join('\n') || '- empty';

  const history = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nWorkspace files (${files.length}):\n${fileList}`,
    },
    ...buildHistory(messages),
  ];

  const executed = [];
  let seq = 0;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const completion = await chatCompletion(pruneImages(history));
    if (!completion.ok) {
      await finish(sessionId, emit, `**Orbit's engine hit an error.**\n\n${completion.error}`, executed);
      return;
    }

    const message = completion.message;
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

    if (!toolCalls.length) {
      const answer = (message.content || '').trim() || 'Done.';
      await finish(sessionId, emit, answer, executed);
      return;
    }

    history.push({ role: 'assistant', content: message.content || '', tool_calls: toolCalls });

    for (const call of toolCalls) {
      seq += 1;
      const name = call.function?.name || '';
      const args = parseArgs(call.function?.arguments);
      const id = call.id || `call_${Date.now().toString(36)}_${seq}`;

      emit({ type: 'tool_start', id, name, args });
      const result = await executeTool(name, args, { sessionId, emit });
      emit({
        type: 'tool_result',
        id,
        name,
        ok: result.ok,
        result: result.content.slice(0, 4000),
      });

      history.push({ role: 'tool', tool_call_id: id, name, content: result.content });

      // Desktop tools hand back a screenshot; show it to the model as an image.
      if (result.image) {
        history.push({
          role: 'user',
          content: [
            { type: 'text', text: `Screenshot of Orbit's desktop after ${name}:` },
            { type: 'image_url', image_url: { url: result.image } },
          ],
        });
      }
      executed.push({ id, name, args, content: result.content });
    }
  }

  await finish(
    sessionId,
    emit,
    `Stopped after ${MAX_STEPS} tool rounds. Ask me to continue.`,
    executed
  );
}
