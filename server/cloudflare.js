import { toolDefinitions } from './tools/index.js';

/**
 * Orbit's engine — the only model this app runs.
 * OpenAI-compatible chat completions with function calling.
 */

export const MODEL = {
  id: 'cloudflare/gemma-4-26b-a4b-it',
  remote: '@cf/google/gemma-4-26b-a4b-it',
  label: 'Orbit 1.2',
  provider: 'Orbit',
  note: 'Locked — the only model',
};

const API_ROOT = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 90_000;

export function configStatus() {
  const missing = [];
  if (!process.env.CLOUDFLARE_API_KEY) missing.push('CLOUDFLARE_API_KEY');
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) missing.push('CLOUDFLARE_ACCOUNT_ID');
  return { configured: missing.length === 0, missing };
}

function endpoint() {
  return `${API_ROOT}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`;
}

function stripImages(messages) {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    const text = message.content
      .filter((part) => part?.type !== 'image_url')
      .map((part) => part.text || '')
      .join('\n')
      .trim();
    if (text) return { ...message, content: text };
    return { ...message, content: '(screenshot omitted)' };
  });
}

/**
 * One non-streaming completion. Returns { ok, message } where message is an
 * OpenAI-shaped assistant message, or { ok: false, error }.
 */
export async function chatCompletion(messages) {
  const { configured, missing } = configStatus();
  if (!configured) {
    return {
      ok: false,
      error: `The AI engine is not configured. Add ${missing.join(' and ')} to the app secrets.`,
    };
  }

  const post = (payloadMessages) =>
    fetch(endpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL.remote,
        messages: payloadMessages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let response;
  try {
    response = await post(messages);
  } catch (error) {
    return { ok: false, error: `Could not reach the engine: ${error.message}` };
  }

  // Screenshots are optional: if the model rejects image parts, retry text-only.
  const hadImages = messages.some(
    (m) => Array.isArray(m.content) && m.content.some((part) => part?.type === 'image_url')
  );
  if (!response.ok && hadImages && [400, 413, 415, 422].includes(response.status)) {
    try {
      response = await post(stripImages(messages));
    } catch (error) {
      return { ok: false, error: `Could not reach the engine: ${error.message}` };
    }
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail =
      data?.errors?.map((item) => item.message).filter(Boolean).join('; ') ||
      data?.error?.message ||
      text.slice(0, 300) ||
      `HTTP ${response.status}`;
    return { ok: false, error: `Engine ${response.status}: ${detail}` };
  }

  const message = data.choices?.[0]?.message;
  if (message) return { ok: true, message };

  if (typeof data.result?.response === 'string') {
    return { ok: true, message: { role: 'assistant', content: data.result.response } };
  }

  return { ok: false, error: 'The engine returned an unexpected response.' };
}
