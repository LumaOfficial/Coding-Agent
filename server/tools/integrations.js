import { browserCommand } from '../browser.js';

/**
 * Everyday integrations that need no API key and no client ID.
 *
 * Everything here rides on the Orbit browser extension: Orbit opens the
 * provider's own web app in the user's signed-in tab and, for anything that
 * changes state (send, create, play), the user approves it in the chat first.
 * Nothing is stored — the account, the session and the send button stay theirs.
 */

const EMAIL_LABEL = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  yahoo: 'Yahoo Mail',
  mailto: 'your mail app',
};

const INBOX_URL = {
  gmail: 'https://mail.google.com/mail/u/0/#inbox',
  outlook: 'https://outlook.live.com/mail/0/',
  yahoo: 'https://mail.yahoo.com',
};

const MUSIC_LABEL = {
  youtube: 'YouTube Music',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  apple: 'Apple Music',
};

function pick(value, allowed, fallback) {
  const key = String(value || '').toLowerCase();
  return allowed.includes(key) ? key : fallback;
}

function addresses(value) {
  return String(value || '')
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',');
}

function composeUrl({ provider, to, cc, bcc, subject, body }) {
  const params = new URLSearchParams();
  if (provider === 'gmail') {
    params.set('view', 'cm');
    params.set('fs', '1');
    params.set('tf', '1');
    params.set('to', to);
    if (cc) params.set('cc', cc);
    if (bcc) params.set('bcc', bcc);
    if (subject) params.set('su', subject);
    if (body) params.set('body', body);
    return `https://mail.google.com/mail/?${params.toString()}`;
  }
  if (provider === 'outlook') {
    params.set('to', to);
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);
    return `https://outlook.live.com/mail/0/deeplink/compose?${params.toString()}`;
  }
  if (provider === 'yahoo') {
    params.set('to', to);
    if (cc) params.set('cc', cc);
    if (bcc) params.set('bcc', bcc);
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);
    return `https://compose.mail.yahoo.com/?${params.toString()}`;
  }
  // Default: hand the message to whatever mail app the user has installed.
  params.set('subject', subject || '');
  params.set('body', body || '');
  if (cc) params.set('cc', cc);
  if (bcc) params.set('bcc', bcc);
  return `mailto:${to}?${params.toString()}`;
}

function musicUrl(provider, query) {
  const q = encodeURIComponent(query);
  switch (provider) {
    case 'spotify':
      return `https://open.spotify.com/search/${q}`;
    case 'soundcloud':
      return `https://soundcloud.com/search?q=${q}`;
    case 'apple':
      return `https://music.apple.com/us/search?term=${q}`;
    default:
      return `https://music.youtube.com/search?q=${q}`;
  }
}

/** Calendar wants UTC stamps in the compact YYYYMMDDTHHmmssZ form. */
function stamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function openCommand(ctx, url, summary, detail) {
  return browserCommand(ctx.sessionId, {
    action: 'open',
    params: { url },
    summary,
    detail,
    url,
    needsApproval: true,
  });
}

function clickCommand(ctx, text, summary, detail) {
  return browserCommand(ctx.sessionId, {
    action: 'click',
    params: { text, selector: '', index: null },
    summary,
    detail,
    needsApproval: true,
  });
}

function snapshotCommand(ctx, maxText = 6000) {
  return browserCommand(ctx.sessionId, {
    action: 'snapshot',
    params: { max_text: maxText },
    summary: 'Reading the page in your browser',
    needsApproval: false,
  });
}

function declined(action) {
  return {
    ok: false,
    content: `The user declined this ${action}. Do not retry it — ask what they would prefer instead.`,
  };
}

function bridgeFailure(text, link) {
  return {
    ok: false,
    content: `${text}\n\nEverything is ready in this link — open it to finish:\n${link}`,
  };
}

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'email_compose',
      description:
        "Write an email in the user's own mail account (Gmail, Outlook, Yahoo, or their desktop mail app). No API key: Orbit opens a pre-filled message in the user's signed-in browser and, if asked to send, presses Send only after the user approves. Use this whenever the user asks you to email someone.",
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address(es), comma separated.' },
          subject: { type: 'string', description: 'Subject line.' },
          body: { type: 'string', description: 'Plain-text message body.' },
          cc: { type: 'string', description: 'Optional CC addresses.' },
          bcc: { type: 'string', description: 'Optional BCC addresses.' },
          provider: {
            type: 'string',
            enum: ['gmail', 'outlook', 'yahoo', 'mailto'],
            description: "Which mail app to use. Defaults to gmail; 'mailto' opens the user's desktop mail app.",
          },
          send: {
            type: 'boolean',
            description:
              'Press Send after the message is filled in. Defaults to false so the user can read it first.',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'email_inbox',
      description:
        "Open the user's inbox in their signed-in webmail and read what is on screen (subjects, senders, previews). Use it when the user asks you to check or summarise their email. No API key needed.",
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: ['gmail', 'outlook', 'yahoo'],
            description: 'Which webmail to open. Defaults to gmail.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_repo',
      description:
        "Create a GitHub repository with the user's own signed-in session — no token. Orbit opens the new-repository page pre-filled with the name and description, then presses Create repository after the user approves.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Repository name.' },
          description: { type: 'string', description: 'Short repository description.' },
          owner: {
            type: 'string',
            description: 'Optional organization to create it under. Defaults to the signed-in user.',
          },
          private: {
            type: 'boolean',
            description: 'Ask for a private repository — the user confirms visibility on the page.',
          },
          create: {
            type: 'boolean',
            description:
              'Press Create repository after filling the form. Defaults to true; false only opens the pre-filled page.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'music_play',
      description:
        "Start music in the user's browser on YouTube Music, Spotify, SoundCloud or Apple Music. Give a search query (song, artist, album or playlist) or a direct link. No API key: it opens the provider's own player in the signed-in tab.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to play, e.g. "lo-fi beats" or "Daft Punk".' },
          provider: {
            type: 'string',
            enum: ['youtube', 'spotify', 'soundcloud', 'apple'],
            description: 'Which music service. Defaults to youtube.',
          },
          url: { type: 'string', description: 'Optional direct track or playlist URL to open instead.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calendar_event',
      description:
        "Create a calendar event in the user's Google Calendar without an API key: Orbit opens the pre-filled event page and the user saves it. Use it when the user asks to schedule something.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title.' },
          start: { type: 'string', description: 'Start time, ISO 8601, e.g. 2026-11-21T15:00:00-05:00.' },
          end: { type: 'string', description: 'End time, ISO 8601. Defaults to one hour after start.' },
          details: { type: 'string', description: 'Optional description.' },
          location: { type: 'string', description: 'Optional location.' },
        },
        required: ['title'],
      },
    },
  },
];

export const handlers = {
  async email_compose(args, ctx) {
    const to = addresses(args.to);
    if (!to) return { ok: false, content: 'An email needs at least one recipient in `to`.' };

    const provider = pick(args.provider, ['gmail', 'outlook', 'yahoo', 'mailto'], 'gmail');
    const url = composeUrl({
      provider,
      to,
      cc: addresses(args.cc),
      bcc: addresses(args.bcc),
      subject: String(args.subject || ''),
      body: String(args.body || ''),
    });
    const label = EMAIL_LABEL[provider];

    const opened = await openCommand(
      ctx,
      url,
      `Writing an email to ${to} in ${label}`,
      args.subject ? `Subject: “${args.subject}”` : 'The message is pre-filled.'
    );
    if (opened.denied) return declined('email');
    if (!opened.ok) return bridgeFailure(opened.text, url);

    if (args.send && provider !== 'mailto') {
      const sent = await clickCommand(
        ctx,
        'Send',
        `Sending the email to ${to}`,
        args.subject ? `Subject: “${args.subject}”` : 'Pressing Send in the compose window.'
      );
      if (sent.denied) return declined('send');
      if (!sent.ok) {
        return {
          ok: false,
          content: `The message is open in ${label} but Orbit could not press Send (${sent.text}). Ask the user to press Send.`,
        };
      }
      return `Email sent to ${to} from the user's own ${label} account.`;
    }

    const note =
      provider === 'outlook' && (args.cc || args.bcc)
        ? ' Outlook does not accept CC/BCC in the pre-filled link — the user can add them before sending.'
        : '';
    return `Email to ${to} is open in ${label}, pre-filled and waiting for the user to press Send.${note}\n${url}`;
  },

  async email_inbox(args, ctx) {
    const provider = pick(args.provider, ['gmail', 'outlook', 'yahoo'], 'gmail');
    const url = INBOX_URL[provider];

    const opened = await openCommand(
      ctx,
      url,
      `Opening ${EMAIL_LABEL[provider]}`,
      'Orbit reads the inbox that is on screen.'
    );
    if (opened.denied) return declined('inbox');
    if (!opened.ok) return bridgeFailure(opened.text, url);

    const snapshot = await snapshotCommand(ctx, 6000);
    if (!snapshot.ok) return { ok: false, content: snapshot.text };
    return snapshot.text || 'The inbox opened but nothing readable was on screen yet.';
  },

  async github_create_repo(args, ctx) {
    const name = String(args.name || '').trim();
    if (!name) return { ok: false, content: 'A repository needs a `name`.' };

    const params = new URLSearchParams({ name });
    if (args.description) params.set('description', String(args.description));
    const owner = String(args.owner || '').trim();
    const url = owner
      ? `https://github.com/organizations/${encodeURIComponent(owner)}/repositories/new?${params.toString()}`
      : `https://github.com/new?${params.toString()}`;

    const opened = await openCommand(
      ctx,
      url,
      `Creating repository ${owner ? `${owner}/` : ''}${name} on GitHub`,
      args.description ? `Description: “${args.description}”` : 'The new-repository form is pre-filled.'
    );
    if (opened.denied) return declined('repository creation');
    if (!opened.ok) return bridgeFailure(opened.text, url);

    if (args.create === false) {
      return `The new-repository form for ${name} is open and pre-filled. Ask the user to check the visibility and press Create repository.\n${url}`;
    }

    const created = await clickCommand(
      ctx,
      'Create repository',
      `Creating repository ${name} on GitHub`,
      args.private
        ? 'Visibility stays whatever the page shows — ask the user to confirm Private if it matters.'
        : 'Pressing Create repository on the pre-filled form.'
    );
    if (created.denied) return declined('repository creation');
    if (!created.ok) {
      return {
        ok: false,
        content: `The form for ${name} is open but Orbit could not press Create repository (${created.text}). Ask the user to press it.`,
      };
    }

    const visibility = args.private
      ? 'Confirm the repository is Private — GitHub remembers the last visibility used.'
      : 'The page shows the repository visibility it was created with.';
    return `Repository ${owner ? `${owner}/` : ''}${name} created through the user's own GitHub session. ${visibility}`;
  },

  async music_play(args, ctx) {
    const direct = String(args.url || '').trim();
    const provider = pick(args.provider, ['youtube', 'spotify', 'soundcloud', 'apple'], 'youtube');
    const query = String(args.query || '').trim();

    let url = direct;
    if (url) {
      if (!/^https?:\/\//i.test(url)) return { ok: false, content: 'That music link must start with http(s).' };
    } else if (query) {
      url = musicUrl(provider, query);
    } else {
      return { ok: false, content: 'Give a `query` to play, or a direct `url`.' };
    }

    const label = MUSIC_LABEL[provider];
    const opened = await openCommand(
      ctx,
      url,
      query ? `Playing ${query} on ${label}` : `Opening music on ${label}`,
      'The provider plays it in the signed-in tab.'
    );
    if (opened.denied) return declined('music playback');
    if (!opened.ok) return bridgeFailure(opened.text, url);

    return query
      ? `${label} is open on “${query}” — press play on the first result if it did not start.\n${url}`
      : `${label} is open in the user's browser.\n${url}`;
  },

  async calendar_event(args, ctx) {
    const title = String(args.title || '').trim();
    if (!title) return { ok: false, content: 'An event needs a `title`.' };

    const params = new URLSearchParams({ action: 'TEMPLATE', text: title });
    const start = stamp(args.start);
    let end = stamp(args.end);
    if (start) {
      if (!end) {
        const startDate = new Date(args.start);
        end = stamp(new Date(startDate.getTime() + 60 * 60 * 1000).toISOString());
      }
      params.set('dates', `${start}/${end}`);
    }
    if (args.details) params.set('details', String(args.details));
    if (args.location) params.set('location', String(args.location));
    const url = `https://calendar.google.com/calendar/render?${params.toString()}`;

    const opened = await openCommand(
      ctx,
      url,
      `Scheduling “${title}”`,
      args.start ? `Starts ${args.start}` : 'The event page is pre-filled.'
    );
    if (opened.denied) return declined('calendar event');
    if (!opened.ok) return bridgeFailure(opened.text, url);

    return `Event “${title}” is open in Google Calendar, pre-filled — press Save.${args.start ? '' : ' No time was given, so the user still picks the date.'}\n${url}`;
  },
};
