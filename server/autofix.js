import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { listWorkspaceFiles, readWorkspaceFile, writeWorkspaceFile } from './store.js';

/**
 * Deterministic code repair and debugging. No external API, no model, no key.
 * Safe fixes are applied; anything ambiguous is reported, never guessed.
 */

const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 400;
const MAX_SYNTAX_CHECKS = 80;

const JS_EXT = new Set(['.js', '.cjs', '.mjs']);
const JS_LIKE = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const TEXT_EXT = new Set([
  ...JS_LIKE,
  '.json',
  '.css',
  '.scss',
  '.html',
  '.md',
  '.txt',
  '.py',
  '.yml',
  '.yaml',
  '.svg',
  '.sh',
  '.env',
]);

const RESOLVE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.css', '.scss'];

function textFixes(input, ext) {
  const changes = [];
  let code = input;

  if (code.includes('\r\n')) {
    code = code.replace(/\r\n/g, '\n');
    changes.push('normalized line endings');
  }

  const trimmed = code.replace(/[ \t]+$/gm, '');
  if (trimmed !== code) {
    changes.push('trimmed trailing whitespace');
    code = trimmed;
  }

  if (code.includes('\t')) {
    const unit = ext === '.py' ? '    ' : '  ';
    code = code.replace(/\t/g, unit);
    changes.push(`converted tabs to ${unit.length} spaces`);
  }

  const collapsed = code.replace(/\n{4,}/g, '\n\n\n');
  if (collapsed !== code) {
    changes.push('collapsed repeated blank lines');
    code = collapsed;
  }

  if (JS_LIKE.has(ext)) {
    const noDebugger = code.replace(/^[ \t]*debugger;?[ \t]*\n/gm, '');
    if (noDebugger !== code) {
      changes.push('removed debugger statement');
      code = noDebugger;
    }
  }

  if (ext === '.json') {
    const noTrailingComma = code.replace(/,(\s*[}\]])/g, '$1');
    if (noTrailingComma !== code) {
      changes.push('removed trailing comma');
      code = noTrailingComma;
    }
  }

  const finalNewline = code.replace(/\s*$/, '\n');
  if (finalNewline !== code) {
    changes.push('fixed final newline');
    code = finalNewline;
  }

  return { code, changes };
}

function checkJson(code, filePath) {
  try {
    JSON.parse(code);
    return [];
  } catch (error) {
    const position = error.message.match(/position (\d+)/);
    const line = position
      ? code.slice(0, Number(position[1])).split('\n').length
      : null;
    return [
      {
        path: filePath,
        line,
        severity: 'error',
        message: `Invalid JSON: ${error.message}`,
      },
    ];
  }
}

function checkJsSyntax(code, filePath, ext, state) {
  if (state.syntaxChecks >= MAX_SYNTAX_CHECKS) return [];
  state.syntaxChecks += 1;

  const run = (suffix) => {
    const tmp = path.join(
      os.tmpdir(),
      `forge-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`
    );
    fs.writeFileSync(tmp, code);
    try {
      execFileSync(process.execPath, ['--check', tmp], {
        stdio: ['ignore', 'ignore', 'pipe'],
        timeout: 5000,
        encoding: 'utf8',
      });
      return { ok: true };
    } catch (error) {
      const stderr = String(error.stderr || error.message || '');
      return { ok: false, stderr, tmp };
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  };

  let result = run(ext);
  if (!result.ok && /Cannot use import statement outside a module|Unexpected token 'export'/.test(result.stderr)) {
    result = run('.mjs');
  }
  if (result.ok) return [];

  const escaped = result.tmp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const location = result.stderr.match(new RegExp(`${escaped}:(\\d+)`));
  const message =
    result.stderr.match(/SyntaxError: ([^\n]+)/)?.[1] ||
    result.stderr.split('\n').find((line) => line.trim()) ||
    'Syntax error';

  return [
    {
      path: filePath,
      line: location ? Number(location[1]) : null,
      severity: 'error',
      message: `Syntax error: ${message}`,
    },
  ];
}

function checkImports(code, filePath, allPaths) {
  const issues = [];
  const pattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(code))) {
    const spec = match[1];
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), spec));
    const candidates = [
      base,
      ...RESOLVE_EXTS.map((ext) => base + ext),
      ...RESOLVE_EXTS.map((ext) => `${base}/index${ext}`),
    ];
    if (candidates.some((candidate) => allPaths.has(candidate))) continue;
    issues.push({
      path: filePath,
      line: code.slice(0, match.index).split('\n').length,
      severity: 'error',
      message: `Import not found: ${spec}`,
    });
  }
  return issues;
}

function checkBraces(code, filePath) {
  const open = (code.match(/{/g) || []).length;
  const close = (code.match(/}/g) || []).length;
  if (open === close) return [];
  return [
    {
      path: filePath,
      line: null,
      severity: 'error',
      message: `Unbalanced braces: ${open} "{" vs ${close} "}"`,
    },
  ];
}

function checkHtmlTags(code, filePath) {
  const issues = [];
  for (const tag of ['script', 'style']) {
    const open = (code.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
    const close = (code.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) {
      issues.push({
        path: filePath,
        line: null,
        severity: 'error',
        message: `Unclosed <${tag}> tag: ${open} opened, ${close} closed`,
      });
    }
  }
  return issues;
}

/**
 * Repairs what is safe and reports what is not. Returns the fixed source.
 */
export function analyzeCode(input, filePath = 'snippet.js', allPaths = null) {
  const ext = path.extname(filePath).toLowerCase();
  const { code, changes } = textFixes(String(input ?? ''), ext);
  const paths = allPaths || new Set([filePath]);
  const state = { syntaxChecks: 0 };

  const issues = [];
  if (ext === '.json') issues.push(...checkJson(code, filePath));
  if (JS_EXT.has(ext)) issues.push(...checkJsSyntax(code, filePath, ext, state));
  if (JS_LIKE.has(ext)) issues.push(...checkImports(code, filePath, paths));
  if (ext === '.css' || ext === '.scss') issues.push(...checkBraces(code, filePath));
  if (ext === '.html') issues.push(...checkHtmlTags(code, filePath));

  return { code, changes, issues };
}

/**
 * Reads the workspace and returns the edits that would be made, without
 * touching any file. Shared by the scan (suggestions) and the apply step.
 */
async function collectWorkspaceFixes(sessionId) {
  const files = (await listWorkspaceFiles(sessionId)).slice(0, MAX_FILES);
  const allPaths = new Set(files.map((file) => file.path));
  const pending = [];
  const issues = [];
  const state = { syntaxChecks: 0 };
  let checked = 0;

  for (const file of files) {
    const ext = path.extname(file.path).toLowerCase();
    if (!TEXT_EXT.has(ext) && !file.path.endsWith('.gitignore')) continue;
    if (file.size > MAX_FILE_BYTES) continue;

    let content;
    try {
      content = await readWorkspaceFile(sessionId, file.path);
    } catch {
      continue;
    }

    checked += 1;
    const { code, changes } = textFixes(content, ext);

    if (code !== content) pending.push({ path: file.path, changes, code });

    if (ext === '.json') issues.push(...checkJson(code, file.path));
    if (JS_EXT.has(ext)) issues.push(...checkJsSyntax(code, file.path, ext, state));
    if (JS_LIKE.has(ext)) issues.push(...checkImports(code, file.path, allPaths));
    if (ext === '.css' || ext === '.scss') issues.push(...checkBraces(code, file.path));
    if (ext === '.html') issues.push(...checkHtmlTags(code, file.path));
  }

  return { checked, pending, issues };
}

function report({ checked, pending, issues }) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  return {
    checked,
    fixes: pending.map((fix) => ({ path: fix.path, changes: fix.changes })),
    issues,
    error_count: errors.length,
    ok: errors.length === 0,
    clean: pending.length === 0 && errors.length === 0,
  };
}

/** Scans the workspace and reports suggested edits without applying them. */
export async function scanWorkspace(sessionId) {
  return report(await collectWorkspaceFixes(sessionId));
}

/** Applies the safe edits and reports what is left. */
export async function fixWorkspace(sessionId) {
  const result = await collectWorkspaceFixes(sessionId);

  for (const fix of result.pending) {
    await writeWorkspaceFile(sessionId, fix.path, fix.code);
  }

  const { fixes, ...rest } = report(result);
  return {
    ...rest,
    clean: rest.error_count === 0,
    fixed_files: fixes.length,
    fixes,
  };
}
