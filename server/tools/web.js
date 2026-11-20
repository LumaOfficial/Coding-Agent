/**
 * Forge's own browser. The agent searches the web and opens pages itself —
 * no API key, no user tab. Search tries Bing, then DuckDuckGo's instant
 * answer API, then Wikipedia. web_fetch reads a public page and returns text.
 */

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT_MS = 12_000;
const MAX_HTML = 500_000;

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
};

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&[a-z#0-9]+;/gi, (match) => ENTITIES[match] ?? ' ');
}

function stripHtml(html) {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeBingUrl(href) {
  const clean = decodeEntities(href);
  const match = clean.match(/[?&]u=a1([^&]+)/);
  if (!match) return clean;
  try {
    const base64 = decodeURIComponent(match[1]).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return clean;
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

async function get(url, headers = {}) {
  const response = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await response.text()).slice(0, MAX_HTML);
  return { ok: response.ok, status: response.status, body, url: response.url };
}

async function bingSearch(query, limit) {
  const { ok, status, body } = await get(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${limit}&setlang=en`
  );
  if (!ok) throw new Error(`Bing responded ${status}`);

  const results = [];
  for (const block of body.split('<li class="b_algo"').slice(1)) {
    const link = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const snippet = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    results.push({
      title: stripHtml(link[2]).slice(0, 160) || 'Untitled',
      url: decodeBingUrl(link[1]),
      snippet: snippet ? stripHtml(snippet[1]).slice(0, 300) : '',
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function duckAnswer(query) {
  const { ok, body } = await get(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  );
  if (!ok) return [];
  const data = JSON.parse(body);
  const results = [];
  if (data.AbstractText) {
    results.push({
      title: data.Heading || 'Answer',
      url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: data.AbstractText,
    });
  }
  for (const topic of data.RelatedTopics || []) {
    if (!topic?.Text || !topic.FirstURL) continue;
    results.push({
      title: topic.Text.split(' - ')[0].slice(0, 160),
      url: topic.FirstURL,
      snippet: topic.Text.slice(0, 300),
    });
    if (results.length >= 6) break;
  }
  return results;
}

async function wikiSearch(query, limit) {
  const { ok, body } = await get(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`
  );
  if (!ok) return [];
  const data = JSON.parse(body);
  return (data.query?.search || []).map((item) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    snippet: stripHtml(item.snippet || '').slice(0, 300),
  }));
}

function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https pages can be opened.');
  }
  const host = url.hostname.toLowerCase();
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  const blocked =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '::1' ||
    host === '[::1]' ||
    (v4 &&
      (Number(v4[1]) === 10 ||
        Number(v4[1]) === 127 ||
        (Number(v4[1]) === 172 && Number(v4[2]) >= 16 && Number(v4[2]) <= 31) ||
        (Number(v4[1]) === 192 && Number(v4[2]) === 168) ||
        (Number(v4[1]) === 169 && Number(v4[2]) === 254)));
  if (blocked) {
    throw new Error('That address is on a private network — Forge only opens public pages.');
  }
  return url;
}

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the live web from Forge\'s own browser and get result titles, URLs and snippets. Use it for anything current, for library versions, error messages or docs you are unsure about, then open a result with web_fetch. No API key needed.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for.' },
          limit: { type: 'number', description: 'How many results, 1–10. Default 6.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description:
        'Open a public web page and return its readable text (scripts and markup stripped). Use it to read documentation, changelogs, issues or articles found with web_search.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full http(s) URL.' },
          max_chars: { type: 'number', description: 'Text budget, 1500–8000. Default 4000.' },
        },
        required: ['url'],
      },
    },
  },
];

export const handlers = {
  async web_search(args) {
    const query = String(args?.query || '').trim();
    if (!query) throw new Error('web_search needs a query.');
    const limit = clamp(args?.limit, 1, 10, 6);

    const attempts = [
      ['Bing', () => bingSearch(query, limit)],
      ['DuckDuckGo', () => duckAnswer(query)],
      ['Wikipedia', () => wikiSearch(query, limit)],
    ];

    for (const [source, run] of attempts) {
      let results = [];
      try {
        results = await run();
      } catch {
        results = [];
      }
      if (!results.length) continue;
      const lines = results.map(
        (item, index) =>
          `${index + 1}. ${item.title}\n   ${item.url}${item.snippet ? `\n   ${item.snippet}` : ''}`
      );
      return `Web search · "${query}" · ${source} · ${results.length} result${
        results.length === 1 ? '' : 's'
      }\n\n${lines.join('\n\n')}\n\nOpen any result with web_fetch to read it.`;
    }

    return `No web results for "${query}". Try different words, or web_fetch a URL you already know.`;
  },

  async web_fetch(args) {
    const url = assertPublicUrl(String(args?.url || '').trim());
    const maxChars = clamp(args?.max_chars, 1500, 8000, 4000);

    const { ok, status, body, url: finalUrl } = await get(url.href, {
      accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
    });

    const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const text = stripHtml(body);
    const head = title ? `${decodeEntities(title).trim()} — ${finalUrl}` : finalUrl;
    const trimmed = text.slice(0, maxChars);

    return `${head} (HTTP ${status})\n\n${trimmed || '(the page returned no readable text)'}${
      text.length > maxChars ? '\n…(truncated — call web_fetch with a higher max_chars for more)' : ''
    }${ok ? '' : '\n\nThe page returned an error status; treat its contents with care.'}`;
  },
};
