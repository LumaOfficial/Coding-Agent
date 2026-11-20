import { useEffect, useState } from 'react';

/** Cosmic phrases Orbit cycles through while it thinks. */
export const COSMIC_THOUGHTS = [
  'Stargazing…',
  'Revolving around Earth…',
  'Charting constellations…',
  'Calculating trajectory…',
  'Scanning deep space…',
];

/** Rotate through `messages` while `active`; resets to the first one otherwise. */
export function useRotatingMessage(messages, interval = 2400, active = true) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, interval);
    return () => clearInterval(timer);
  }, [active, interval, messages.length]);

  return messages[index % messages.length];
}

function clip(value, max = 64) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function quoted(value) {
  const text = clip(value);
  return text ? `"${text}"` : 'a query';
}

function repoPath(args = {}) {
  const base = `${args.owner || ''}/${args.repo || ''}`.replace(/^\/|\/$/g, '');
  return args.path ? `${base}/${args.path}` : base;
}

/** Exact live detail for a running tool, e.g. `Searching the web for "vite 6"…`. */
export function toolActivity(name, args = {}) {
  switch (name) {
    case 'write_file':
      return `Writing ${clip(args.path) || 'a file'}…`;
    case 'read_file':
      return `Reading ${clip(args.path) || 'a file'}…`;
    case 'delete_file':
      return `Deleting ${clip(args.path) || 'a file'}…`;
    case 'list_files':
      return 'Scanning workspace files…';
    case 'autofix_workspace':
      return 'Scanning workspace files for fixes…';
    case 'check_code':
      return `Checking ${clip(args.path) || 'a snippet'}…`;
    case 'detect_platform':
      return 'Detecting the platform…';
    case 'browser_tabs':
      return 'Listing your open tabs…';
    case 'browser_snapshot':
      return 'Reading the page in your browser…';
    case 'browser_screenshot':
      return 'Looking at your browser tab…';
    case 'browser_open':
      return `Opening ${clip(args.url) || 'a page'} in your browser…`;
    case 'browser_click':
      return `Clicking ${clip(args.text || args.selector) || 'an element'} in your browser…`;
    case 'browser_type':
      return `Typing into ${clip(args.label || args.selector) || 'a field'} in your browser…`;
    case 'browser_key':
      return `Pressing ${clip(args.key) || 'a key'} in your browser…`;
    case 'browser_scroll':
      return `Scrolling ${args.direction || 'down'} in your browser…`;
    case 'web_search':
      return `Searching the web for ${quoted(args.query)}…`;
    case 'web_fetch':
      return `Reading ${clip(args.url) || 'a page'}…`;
    case 'list_store_targets':
      return 'Listing app-store targets…';
    case 'test_store_readiness':
      return args.targets?.length
        ? `Testing store readiness for ${clip(args.targets.join(', '))}…`
        : 'Testing app-store readiness…';
    case 'github_search_repos':
      return `Checking GitHub for ${quoted(args.query)}…`;
    case 'github_list_dir':
      return `Listing ${clip(repoPath(args)) || 'a repo'} on GitHub…`;
    case 'github_read_file':
      return `Reading ${clip(repoPath(args)) || 'a file'} on GitHub…`;
    case 'github_create_branch':
      return `Creating branch ${clip(args.branch) || ''} on GitHub…`;
    case 'github_commit_file':
      return `Committing ${clip(args.path) || 'a file'} to ${clip(args.branch) || 'GitHub'}…`;
    case 'github_open_pull_request':
      return `Opening a pull request ${clip(args.head) || ''} → ${clip(args.base) || ''}…`;
    case 'hf_search_models':
      return `Searching Hugging Face models for ${quoted(args.query)}…`;
    case 'hf_search_datasets':
      return `Searching Hugging Face datasets for ${quoted(args.query)}…`;
    case 'hf_search_spaces':
      return `Searching Hugging Face spaces for ${quoted(args.query)}…`;
    case 'hf_model_info':
      return `Reading the model card for ${clip(args.model_id) || 'a model'}…`;
    case 'generate_vscode_workspace':
      return 'Writing VS Code workspace files…';
    case 'desktop_launch':
      return `Opening ${clip(args.app) || 'Chromium'} on Orbit's desktop…`;
    case 'desktop_navigate':
      return `Opening ${clip(args.url) || 'a page'} on Orbit's desktop…`;
    case 'desktop_click':
      return `Clicking ${args.x ?? '?'}, ${args.y ?? '?'} on Orbit's desktop…`;
    case 'desktop_type':
      return "Typing on Orbit's desktop…";
    case 'desktop_key':
      return `Pressing ${clip(args.keys) || 'a key'} on Orbit's desktop…`;
    case 'desktop_terminal':
      return `Running \`${clip(args.command, 44)}\` on Orbit's desktop…`;
    case 'desktop_screenshot':
      return "Looking at Orbit's desktop…";
    case 'desktop_close':
      return "Shutting down Orbit's desktop…";
    case 'list_platforms':
      return 'Listing integrations…';
    case 'platform_request':
      return `Checking ${clip(args.platform || args.path) || 'an integration'}…`;
    default:
      return `${name.replace(/_/g, ' ')}…`;
  }
}
