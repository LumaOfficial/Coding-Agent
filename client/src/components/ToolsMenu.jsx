import { useEffect, useRef, useState } from 'react';
import {
  IconAlert,
  IconCheck,
  IconChevron,
  IconDownload,
  IconFile,
  IconGithub,
  IconPanel,
  IconSpark,
  IconTerminal,
} from './Icons.jsx';

/**
 * Every action lives here. The toolbar and the empty state render the same
 * menu, so tools are never scattered across separate buttons.
 */
const TOOLS = [
  {
    id: 'fix',
    label: 'Fix workspace',
    hint: 'Repair and debug every file',
    icon: IconTerminal,
    prompt: 'Fix the code in my workspace and debug it.',
  },
  {
    id: 'debug',
    label: 'Debug workspace',
    hint: 'Syntax errors, imports, braces',
    icon: IconAlert,
    prompt:
      'Debug my workspace and show every syntax error and missing import with file and line.',
  },
  {
    id: 'snippet',
    label: 'Check a snippet',
    hint: 'Paste code, get it repaired',
    icon: IconSpark,
    prompt:
      'Check this snippet and fix it:\n\n```js\nfunction add(a, b) {\n  return a + b\n}\n\nconst total = add(1, 2;\n```',
  },
  {
    id: 'files',
    label: 'Workspace files',
    hint: 'Browse, read and export a ZIP',
    icon: IconFile,
    panel: 'files',
  },
  {
    id: 'stores',
    label: 'Store readiness',
    hint: 'Test against app stores',
    icon: IconCheck,
    stores: true,
  },
  {
    id: 'github',
    label: 'GitHub',
    hint: 'Search repos and read files',
    icon: IconGithub,
    prompt: 'Search GitHub for a react dashboard starter',
  },
  {
    id: 'hf',
    label: 'Hugging Face',
    hint: 'Search models, datasets, spaces',
    icon: IconSpark,
    prompt: 'Search Hugging Face for a sentiment analysis model',
  },
  {
    id: 'platform',
    label: 'Detect platform',
    hint: 'OS, runtime and installed tools',
    icon: IconPanel,
    prompt: 'What coding platform am I on?',
  },
  {
    id: 'vscode',
    label: 'VS Code files',
    hint: 'Add .code-workspace and tasks',
    icon: IconDownload,
    prompt: 'Generate VS Code workspace files for this project',
  },
];

export default function ToolsMenu({ onSend, onOpenPanel, onOpenStoreTests, inline = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function pick(tool) {
    setOpen(false);
    if (tool.stores) onOpenStoreTests();
    else if (tool.panel) onOpenPanel(tool.panel);
    else if (tool.prompt) onSend(tool.prompt);
  }

  return (
    <div className={`tools ${inline ? 'tools-inline' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={inline ? 'tools-trigger inline' : 'act-btn'}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="All tools"
      >
        <IconSpark width={13} height={13} />
        Tools
        <IconChevron width={11} height={11} className="tools-caret" />
      </button>

      {open && (
        <div className="tools-menu" role="menu">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                className="tools-item"
                role="menuitem"
                onClick={() => pick(tool)}
              >
                <span className="tools-icon">
                  <Icon width={13} height={13} />
                </span>
                <span className="tools-text">
                  <span className="tools-label">{tool.label}</span>
                  <span className="tools-hint">{tool.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
