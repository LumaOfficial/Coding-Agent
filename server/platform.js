import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Local environment detection. Runs no external requests and needs no API key.
 * Results are cached briefly because probing binaries shells out.
 */

const CACHE_MS = 60_000;
let cache = { at: 0, data: null };

const TOOL_PROBES = [
  ['git', ['--version']],
  ['node', ['--version']],
  ['npm', ['--version']],
  ['pnpm', ['--version']],
  ['yarn', ['--version']],
  ['python3', ['--version']],
  ['pip3', ['--version']],
  ['go', ['version']],
  ['rustc', ['--version']],
  ['docker', ['--version']],
  ['make', ['--version']],
  ['gh', ['--version']],
];

const CI_FLAGS = {
  GITHUB_ACTIONS: 'GitHub Actions',
  GITLAB_CI: 'GitLab CI',
  CIRCLECI: 'CircleCI',
  BUILDKITE: 'Buildkite',
  JENKINS_URL: 'Jenkins',
  VERCEL: 'Vercel',
  NETLIFY: 'Netlify',
};

function readSafe(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function runRaw(bin, args) {
  try {
    return execFileSync(bin, args, {
      encoding: 'utf8',
      timeout: 2500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function firstLine(bin, args) {
  const out = runRaw(bin, args);
  return out ? out.split('\n')[0].slice(0, 120) : null;
}

function versionOf(bin, args) {
  const line = firstLine(bin, args);
  if (!line) return null;
  return line.match(/\d+(\.\d+)+/)?.[0] || line.slice(0, 60);
}

function osInfo() {
  const raw = readSafe('/etc/os-release');
  if (!raw) return null;
  const fields = {};
  for (const line of raw.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    fields[line.slice(0, eq)] = line.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return {
    name: fields.NAME || null,
    version: fields.VERSION_ID || null,
    pretty: fields.PRETTY_NAME || fields.NAME || null,
  };
}

function containerInfo() {
  if (readSafe('/run/.containerenv')) return 'podman';
  if (fs.existsSync('/.dockerenv')) return 'docker';
  const cgroup = readSafe('/proc/1/cgroup') || '';
  if (cgroup.includes('kubepods')) return 'kubernetes';
  if (cgroup.includes('docker') || cgroup.includes('containerd')) return 'docker';
  return null;
}

function editorInfo() {
  const env = process.env;
  const terminal = env.TERM_PROGRAM || env.TERM || null;
  if (env.VSCODE_PID || env.VSCODE_IPC_HOOK || env.TERM_PROGRAM === 'vscode') {
    return { name: 'VS Code', terminal };
  }
  if (env.CURSOR_TRACE_ID || /cursor/i.test(env.TERM_PROGRAM || '')) {
    return { name: 'Cursor', terminal };
  }
  if (env.JETBRAINS_IDE || /jetbrains|idea/i.test(env.TERMINAL_EMULATOR || '')) {
    return { name: 'JetBrains IDE', terminal };
  }
  if (env.TERM_PROGRAM === 'Apple_Terminal') return { name: 'Terminal.app', terminal };
  if (env.TERM_PROGRAM === 'iTerm.app') return { name: 'iTerm', terminal };
  return { name: null, terminal };
}

function ciInfo() {
  for (const [flag, name] of Object.entries(CI_FLAGS)) {
    if (process.env[flag]) return { name, isCI: true };
  }
  return { name: null, isCI: Boolean(process.env.CI) };
}

function findGitDir(start = process.cwd()) {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, '.git');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readRemote(gitDir) {
  const config = gitDir ? readSafe(path.join(gitDir, 'config')) : null;
  if (!config) return null;
  const match = config.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
  return match ? match[1].trim() : null;
}

function gitInfo() {
  const branch = firstLine('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const gitDir = findGitDir();
  if (!branch && !gitDir) return { repo: false };

  const head = gitDir ? readSafe(path.join(gitDir, 'HEAD')) : null;
  const headBranch = head?.startsWith('ref: refs/heads/')
    ? head.trim().replace('ref: refs/heads/', '')
    : head
      ? `detached@${head.trim().slice(0, 7)}`
      : null;
  const status = runRaw('git', ['status', '--porcelain']);

  return {
    repo: true,
    branch: branch && branch !== 'HEAD' ? branch : headBranch,
    remote: firstLine('git', ['remote', 'get-url', 'origin']) || readRemote(gitDir),
    dirty: status === null ? null : Boolean(status),
  };
}

function toolsInfo() {
  const tools = {};
  for (const [bin, args] of TOOL_PROBES) {
    tools[bin] = versionOf(bin, args);
  }
  return tools;
}

function clientInfo(headers = {}) {
  const ua = String(headers['user-agent'] || '');
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const osName = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  return { browser, os: osName };
}

export function detectPlatform(headers = {}) {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const osRelease = osInfo();
  const container = containerInfo();
  const git = gitInfo();
  const tools = toolsInfo();
  const editor = editorInfo();
  const ci = ciInfo();
  const client = clientInfo(headers);
  const runtime = {
    node: process.versions.node,
    v8: process.versions.v8,
    npm: tools.npm,
  };

  const host = {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memory_gb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  };

  const parts = [];
  if (container) parts.push(`${container} container`);
  parts.push(osRelease?.pretty || `${host.platform} ${host.release}`);
  parts.push(`node ${runtime.node}`);
  if (git.repo) parts.push(`git repo (${git.branch}${git.dirty ? ', uncommitted changes' : ''})`);
  if (editor.name) parts.push(editor.name);
  if (ci.name) parts.push(ci.name);
  const installed = Object.keys(tools).filter((bin) => tools[bin]);
  if (installed.length) parts.push(`tools: ${installed.join(', ')}`);

  const data = {
    detected_at: new Date().toISOString(),
    summary: parts.join(' · '),
    host,
    os: osRelease,
    container,
    runtime,
    shell: process.env.SHELL || null,
    editor,
    ci,
    git,
    tools,
    client,
  };

  cache = { at: Date.now(), data };
  return data;
}
