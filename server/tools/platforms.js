import { findPlatform, listPlatforms } from '../platforms.js';

const TIMEOUT_MS = 12_000;
const MAX_BODY = 4000;

/**
 * Read-only access to a catalog platform. Only hosts declared in
 * server/platforms.js are reachable, always with GET, and credentials come
 * from the platform's own env var — the caller never passes a key.
 */
async function readPlatform(id, requestPath) {
  const platform = findPlatform(id);
  if (!platform) {
    return { ok: false, content: `Unknown platform: ${id}. Call list_platforms for the ids.` };
  }
  if (!platform.api) {
    return {
      ok: false,
      content: `${platform.name} has no public REST base here — open ${platform.site || platform.docs} with web_fetch or desktop_navigate. No token needed.`,
    };
  }

  const configured = platform.env.every((name) => Boolean(process.env[name]));
  const suffix = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  const url = `${platform.api}${suffix}`;
  if (new URL(url).origin !== new URL(platform.api).origin) {
    return { ok: false, content: 'Path must stay on the platform host.' };
  }

  const headers = { Accept: 'application/json' };
  if (platform.auth && process.env[platform.auth.env]) {
    headers[platform.auth.header] = `${platform.auth.prefix}${process.env[platform.auth.env]}`;
  }
  Object.assign(headers, platform.extraHeaders || {});

  let response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    return { ok: false, content: `${platform.name} request failed: ${error.message}` };
  }

  const text = await response.text();
  if (!response.ok && !configured && response.status >= 400 && response.status < 500) {
    return {
      ok: false,
      content:
        `${platform.name} GET ${suffix} → ${response.status}. That path is private. ` +
        `No token needed: read the public pages with web_fetch (${platform.site || platform.docs}) ` +
        `or open ${platform.site || platform.docs} with desktop_navigate.`,
    };
  }
  return {
    ok: response.ok,
    content: `${platform.name} GET ${suffix} → ${response.status}\n\n${text.slice(0, MAX_BODY)}`,
  };
}

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'list_platforms',
      description:
        'List every platform in the catalog (GitHub, GitLab, Vercel, Supabase, Hugging Face, Figma, Slack, Sentry…) with its category and how it is reached. None of them needs a token: public APIs answer anonymous reads, and the rest are read in the agent\'s own browser. Call it when asked what the agent can connect to.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional category filter, e.g. "Deploy" or "AI & ML".',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'platform_request',
      description:
        'Read a path from a catalog platform\'s public REST API (GET only) without a token, for example {"platform":"npm","path":"/react"} or {"platform":"gitlab","path":"/projects"}. If the path needs sign-in, the result tells you to use web_fetch or desktop_navigate instead.',
      parameters: {
        type: 'object',
        properties: {
          platform: { type: 'string', description: 'Platform id from list_platforms, e.g. "gitlab".' },
          path: { type: 'string', description: 'API path, starting with "/".' },
        },
        required: ['platform', 'path'],
      },
    },
  },
];

export const handlers = {
  async list_platforms(args) {
    const platforms = listPlatforms();
    const category = String(args?.category || '').toLowerCase();
    const filtered = category
      ? platforms.filter((platform) => platform.category.toLowerCase().includes(category))
      : platforms;

    const lines = filtered.map((platform) => {
      const access =
        platform.mode === 'public'
          ? 'public API'
          : platform.mode === 'browser'
            ? `own browser${platform.site ? ` (${platform.site})` : ''}`
            : platform.mode;
      return (
        `- ${platform.name} (${platform.id}) · ${platform.category} · ${access} · no token needed` +
        `${platform.tokenOptional ? ` · optional ${platform.env.join(', ')} for private actions` : ''}`
      );
    });
    return `${filtered.length} platforms, all usable without a token\n${lines.join('\n')}`;
  },

  async platform_request(args) {
    const id = String(args?.platform || '').trim();
    const requestPath = String(args?.path || '/').trim() || '/';
    const result = await readPlatform(id, requestPath);
    if (!result.ok) throw new Error(result.content);
    return result.content;
  },
};
