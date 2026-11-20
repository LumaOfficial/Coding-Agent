import { getMessages, addMessage, getSession } from './store.js';
import { executeTool } from './tools/index.js';
import { detectTargets } from './stores.js';

/**
 * Local agent. Runs entirely on this machine — no model, no external API,
 * no Groq key. It routes the request to the deterministic repair/debug tools
 * and reports the result.
 */

export const LOCAL_MODEL = {
  id: 'local/autofix',
  label: 'Local auto-fix',
  note: 'Deterministic repair + debugging, no API key',
};

const HELP_TEXT = `**Local engine — no API key is used.**

I repair and debug code with deterministic checks:

- **Fix my workspace** — applies safe fixes (line endings, whitespace, tabs, trailing commas, \`debugger\`, final newline) and lists what still fails.
- **Debug** — reports syntax errors, invalid JSON, missing imports, unbalanced braces and unclosed tags with file and line.
- **Paste a snippet** — send a fenced code block and I return the corrected code plus any remaining problems.
- **List files** — shows what is in the workspace.
- **Detect my platform** — reports the OS, container, runtime and installed tools.
- **GitHub** — search public repos, list a repo's files and read any file. No token needed.
- **Hugging Face** — search models, datasets and spaces, and read model cards. No token needed.
- **Test store readiness** — checks the workspace against Chrome Web Store, Edge Add-ons, Mozilla Add-ons, Opera Add-ons, Google Play, Apple App Store, VS Code Marketplace and Hugging Face Spaces, and lists exactly what each one is missing.

Say "search github for react", "find a hugging face model for sentiment", "fix my code" or "test my store readiness" to start.`;

const EXT_BY_LANG = {
  js: 'js',
  javascript: 'js',
  jsx: 'jsx',
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
  json: 'json',
  css: 'css',
  html: 'html',
  python: 'py',
  py: 'py',
  yml: 'yml',
  yaml: 'yaml',
  sh: 'sh',
  bash: 'sh',
  md: 'md',
};

function extractCodeBlock(text) {
  const match = text.match(/```([\w+-]*)[ \t]*\n([\s\S]*?)```/);
  if (!match) return null;
  const lang = (match[1] || 'js').toLowerCase();
  return { code: match[2], ext: EXT_BY_LANG[lang] || 'txt' };
}

const STORE_WORDS =
  /\b(store|stores|marketplace|marketplaces|add-?ons?|listing|readiness|submission)\b/;
const STORE_NAMES =
  /chrome web|play store|app store|google play|mozilla|firefox|opera|edge add|vs ?code marketplace/;

function classify(text, snippet) {
  const lower = text.toLowerCase();
  if (snippet) return 'snippet';
  if (STORE_WORDS.test(lower) || STORE_NAMES.test(lower)) return 'stores';
  if (/\bgithub\b|github\.com/.test(lower)) return 'github';
  if (/\b(hugging\s?face|hf)\b/.test(lower) || /\bmodel card\b/.test(lower)) return 'hf';

  if (/\b(fix|repair|autofix|auto-fix|debug|lint|check|errors?|broken|syntax|not working)\b/.test(lower)) {
    return 'fix';
  }
  if (/\b(platform|environment|machine|system info|what os|detect)\b/.test(lower)) return 'platform';
  if (/\b(list|files|workspace)\b/.test(lower)) return 'files';
  if (/\b(read|open|show)\b.*\.\w+/.test(lower)) return 'read';
  return 'help';
}

const GITHUB_STOP =
  /\b(please|search|find|look|up|show|me|for|about|on|in|from|github|repos?|repositories?|projects?|a|an|the|some|any)\b/gi;
const HF_STOP =
  /\b(please|search|find|look|up|show|me|for|about|on|in|from|hugging|face|hf|models?|datasets?|spaces?|a|an|the|some|any)\b/gi;

function cleanQuery(text, stop) {
  return text
    .replace(stop, ' ')
    .replace(/[?!.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pick the GitHub tool for a message — public reads, no token involved. */
function parseGitHub(text) {
  const url = text.match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:blob|tree)\/([^\s)?"']+))?/i);
  if (url) {
    const [, owner, repo, rest] = url;
    if (rest) {
      const parts = rest.split('/');
      const path = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
      return { tool: 'github_read_file', args: { owner, repo, path } };
    }
    return { tool: 'github_list_dir', args: { owner, repo } };
  }

  const lower = text.toLowerCase();
  const repoRef = text.match(/\b([\w.-]+)\/([\w.-]+)\b/);
  if (repoRef && /\b(list|browse|files?|contents?|read|open|show|repo|repository)\b/.test(lower)) {
    const [, owner, repo] = repoRef;
    const fileRef = text.match(/\b[\w.-]+(?:\/[\w.-]+)+\.[a-z0-9]{1,6}\b/i);
    if (fileRef && /\b(read|open|show)\b/.test(lower)) {
      const path = fileRef[0].replace(new RegExp(`^${owner}/${repo}/`, 'i'), '');
      return { tool: 'github_read_file', args: { owner, repo, path } };
    }
    return { tool: 'github_list_dir', args: { owner, repo } };
  }

  const query = cleanQuery(text, GITHUB_STOP);
  if (!query) return null;
  return { tool: 'github_search_repos', args: { query } };
}

/** Pick the Hugging Face tool for a message — public search, no token involved. */
function parseHuggingFace(text) {
  const lower = text.toLowerCase();
  const modelRef = text.match(/\b([\w.-]+\/[\w.-]+)\b/);
  if (modelRef && /\b(model card|model info|details|readme|about)\b/.test(lower)) {
    return { tool: 'hf_model_info', args: { model_id: modelRef[1] } };
  }

  const kind = /\bdatasets?\b/.test(lower) ? 'datasets' : /\bspaces?\b/.test(lower) ? 'spaces' : 'models';
  const query = cleanQuery(text, HF_STOP);
  if (!query) return null;
  return { tool: `hf_search_${kind}`, args: { query } };
}

function formatIssues(issues) {
  if (!issues.length) return '';
  return issues
    .slice(0, 25)
    .map((issue) => `- \`${issue.path}${issue.line ? `:${issue.line}` : ''}\` — ${issue.message}`)
    .join('\n');
}

function summarizeWorkspaceFix(data) {
  if (!data.checked) {
    return '**Workspace is empty.** Nothing to fix yet — paste a fenced code block and I will check it.';
  }
  const lines = [
    `**Checked ${data.checked} file${data.checked === 1 ? '' : 's'}** · ${data.fixed_files} fixed · ${data.error_count} problem${data.error_count === 1 ? '' : 's'} left`,
  ];
  if (data.fixes.length) {
    lines.push('', '**Repaired**');
    for (const fix of data.fixes.slice(0, 15)) {
      lines.push(`- \`${fix.path}\` — ${fix.changes.join(', ')}`);
    }
  }
  if (data.issues.length) {
    lines.push('', '**Still broken**', formatIssues(data.issues));
  } else if (data.fixed_files) {
    lines.push('', 'Everything else checks out: no syntax errors or missing imports.');
  } else {
    lines.push('', 'Everything checks out: no syntax errors or missing imports.');
  }
  return lines.join('\n');
}

function summarizeSnippet(data) {
  const lines = [`**Checked \`${data.path}\`**`];
  if (data.changes.length) {
    lines.push('', `Fixed: ${data.changes.join(', ')}`);
  }
  if (data.issues.length) {
    lines.push('', '**Problems**', formatIssues(data.issues));
  } else {
    lines.push('', 'No syntax errors or missing imports.');
  }
  if (data.changes.length) {
    lines.push('', '```' + (data.path.split('.').pop() || ''), data.code.trimEnd(), '```');
  }
  return lines.join('\n');
}

function summarizePlatform(data) {
  return [
    `**${data.summary}**`,
    '',
    `- Runtime: Node ${data.runtime.node}`,
    `- Host: ${data.host.platform} ${data.host.release} · ${data.host.arch} · ${data.host.cpus} CPUs`,
    `- Container: ${data.container || 'none'}`,
    `- Shell: ${data.shell || 'unknown'}`,
    `- Editor: ${data.editor?.name || 'not detected'}`,
    `- CI: ${data.ci?.name || 'none'}`,
    `- Git: ${data.git?.repo ? `${data.git.branch}${data.git.remote ? ` · ${data.git.remote}` : ''}` : 'not a repo'}`,
    `- Tools: ${Object.entries(data.tools)
      .filter(([, version]) => version)
      .map(([bin, version]) => `${bin} ${version}`)
      .join(', ') || 'none found'}`,
  ].join('\n');
}

function summarizeStores(data) {
  const targets = data.targets || [];
  if (!targets.length) return 'No store targets selected.';
  const lines = [
    `**Store readiness — ${data.workspace_files} file${data.workspace_files === 1 ? '' : 's'} scanned**`,
    '',
  ];

  for (const target of targets) {
    const mark = target.status === 'ready' ? '✅' : target.status === 'needs-work' ? '⚠️' : '❌';
    lines.push(
      `${mark} **${target.name}** — ${target.score}/100 · ${target.counts.fail} missing · ${target.counts.warn} warning${
        target.counts.warn === 1 ? '' : 's'
      }`
    );
    const items = target.checks.filter((item) => item.status !== 'pass').slice(0, 8);
    for (const item of items) {
      lines.push(
        `- ${item.status === 'fail' ? '**Missing**' : 'Warn'} — ${item.label}${
          item.detail ? `: ${item.detail}` : ''
        }`
      );
    }
    if (!items.length) lines.push('- Nothing missing.');
    lines.push('');
  }

  lines.push(
    `**Totals** · ${data.totals.ready} ready · ${data.totals.blocked} blocked · ${data.totals.fails} missing item${data.totals.fails === 1 ? '' : 's'}`
  );
  return lines.join('\n');
}

function summarizeFiles(data) {
  const files = data.files || [];
  if (!files.length) return '**Workspace is empty.** Paste a code block to check it, or ask me to fix the workspace.';
  return [
    `**${files.length} file${files.length === 1 ? '' : 's'}**`,
    '',
    ...files.slice(0, 60).map((file) => `- \`${file.path}\` · ${file.size} B`),
  ].join('\n');
}

function summarizeGitHub(toolName, args, content) {
  if (toolName === 'github_read_file') {
    return `**\`${args.owner}/${args.repo}/${args.path}\`**\n\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\``;
  }
  if (toolName === 'github_list_dir') {
    const where = `${args.owner}/${args.repo}${args.path ? `/${args.path}` : ''}`;
    return `**\`${where}\`**\n\n\`\`\`\n${content}\n\`\`\`\n\n_Public read — no token needed._`;
  }
  return `**GitHub repositories**\n\n${content}\n\n_Public read — no token needed._`;
}

function summarizeHuggingFace(toolName, args, content) {
  if (toolName === 'hf_model_info') {
    return `**Hugging Face · \`${args.model_id}\`**\n\n${content}\n\n_Public read — no token needed._`;
  }
  const kind = toolName.replace('hf_search_', '');
  return `**Hugging Face ${kind}**\n\n${content}\n\n_Public search — no token needed._`;
}

export async function runAgent({ sessionId, emit }) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const messages = await getMessages(sessionId);
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  const text = (lastUser?.content || '').trim();

  const snippet = extractCodeBlock(text);
  const intent = classify(text, snippet);

  let toolName = null;
  let args = {};
  if (intent === 'stores') {
    toolName = 'test_store_readiness';
    const targets = detectTargets(text);
    if (targets) args = { targets };
  } else if (intent === 'fix') {
    toolName = 'autofix_workspace';
  } else if (intent === 'snippet') {
    toolName = 'check_code';
    args = { code: snippet.code, path: `snippet.${snippet.ext}` };
  } else if (intent === 'github') {
    const request = parseGitHub(text);
    if (request) {
      toolName = request.tool;
      args = request.args;
    }
  } else if (intent === 'hf') {
    const request = parseHuggingFace(text);
    if (request) {
      toolName = request.tool;
      args = request.args;
    }
  } else if (intent === 'platform') {
    toolName = 'detect_platform';
  } else if (intent === 'files') {
    toolName = 'list_files';
  } else if (intent === 'read') {
    const match = text.match(/([\w./-]+\.[\w]+)/);
    if (match) {
      toolName = 'read_file';
      args = { path: match[1] };
    }
  }

  if (!toolName) {
    await addMessage(sessionId, { role: 'assistant', content: HELP_TEXT });
    emit({ type: 'text', delta: HELP_TEXT });
    emit({ type: 'done' });
    return;
  }

  const callId = `call_${Date.now().toString(36)}`;
  emit({ type: 'tool_start', id: callId, name: toolName, args });

  const result = await executeTool(toolName, args, { sessionId });
  emit({
    type: 'tool_result',
    id: callId,
    name: toolName,
    ok: result.ok,
    result: result.content.slice(0, 4000),
  });

  let summary;
  if (!result.ok) {
    summary = `**${toolName} failed**\n\n${result.content}`;
  } else {
    let data;
    try {
      data = JSON.parse(result.content);
    } catch {
      data = null;
    }
    if (toolName === 'autofix_workspace' && data) summary = summarizeWorkspaceFix(data);
    else if (toolName === 'test_store_readiness' && data) summary = summarizeStores(data);
    else if (toolName === 'check_code' && data) summary = summarizeSnippet(data);
    else if (toolName === 'detect_platform' && data) summary = summarizePlatform(data);
    else if (toolName === 'list_files' && data) summary = summarizeFiles(data);
    else if (toolName.startsWith('github_')) summary = summarizeGitHub(toolName, args, result.content);
    else if (toolName.startsWith('hf_')) summary = summarizeHuggingFace(toolName, args, result.content);
    else if (toolName === 'read_file' && data) {
      summary = `**\`${args.path}\`**\n\n\`\`\`\n${String(data.content || '').slice(0, 4000)}\n\`\`\``;
    } else summary = result.content;
  }

  await addMessage(sessionId, {
    role: 'assistant',
    content: summary,
    tool_calls: [{ id: callId, name: toolName, arguments: JSON.stringify(args) }],
  });
  await addMessage(sessionId, {
    role: 'tool',
    tool_call_id: callId,
    name: toolName,
    content: result.content,
  });

  emit({ type: 'text', delta: summary });
  emit({ type: 'done' });
}
