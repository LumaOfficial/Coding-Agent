import { useState } from 'react';
import { IconChevron, IconFile, IconGithub, IconSpark, IconTerminal } from './Icons.jsx';

export function toolSummary(name, args = {}) {
  switch (name) {
    case 'write_file':
      return `Write ${args.path || 'file'}`;
    case 'read_file':
      return `Read ${args.path || 'file'}`;
    case 'delete_file':
      return `Delete ${args.path || 'file'}`;
    case 'list_files':
      return 'List workspace files';
    case 'github_search_repos':
      return `Search GitHub · ${args.query || ''}`;
    case 'github_list_dir':
      return `List ${args.owner || ''}/${args.repo || ''}${args.path ? `/${args.path}` : ''}`;
    case 'github_read_file':
      return `Read ${args.owner || ''}/${args.repo || ''}/${args.path || ''}`;
    case 'github_create_branch':
      return `Branch ${args.branch || ''}`;
    case 'github_commit_file':
      return `Commit ${args.path || ''} → ${args.branch || ''}`;
    case 'github_open_pull_request':
      return `PR ${args.head || ''} → ${args.base || ''}`;
    case 'hf_search_models':
      return `Hugging Face models · ${args.query || ''}`;
    case 'hf_search_datasets':
      return `Hugging Face datasets · ${args.query || ''}`;
    case 'hf_search_spaces':
      return `Hugging Face spaces · ${args.query || ''}`;
    case 'hf_model_info':
      return `Model card · ${args.model_id || ''}`;
    case 'generate_vscode_workspace':
      return 'VS Code workspace files';
    default:
      return name;
  }
}

function ToolIcon({ name }) {
  if (name.startsWith('github_')) return <IconGithub width={13} height={13} />;
  if (name.startsWith('hf_')) return <IconSpark width={13} height={13} />;
  if (name === 'generate_vscode_workspace') return <IconTerminal width={13} height={13} />;
  return <IconFile width={13} height={13} />;
}

export default function ToolCard({ name, args, result, status = 'ok' }) {
  const [open, setOpen] = useState(false);
  const summary = toolSummary(name, args);

  return (
    <div className={`tool-card ${status}`}>
      <button className="tool-head" onClick={() => setOpen((v) => !v)}>
        <span className={`tool-dot ${status}`} />
        <span className="tool-icon">
          <ToolIcon name={name} />
        </span>
        <span className="tool-name">{summary}</span>
        <span className="tool-status">
          {status === 'running' ? 'running' : status === 'error' ? 'failed' : 'done'}
        </span>
        <span className={`tool-chevron ${open ? 'open' : ''}`}>
          <IconChevron width={13} height={13} />
        </span>
      </button>
      {open && (
        <div className="tool-body">
          <div className="tool-label">Input</div>
          <pre>{JSON.stringify(args || {}, null, 2)}</pre>
          {result !== undefined && (
            <>
              <div className="tool-label">Output</div>
              <pre>{result || '(empty)'}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
