import { useState } from 'react';
import {
  IconAlert,
  IconCheck,
  IconClose,
  IconCopy,
  IconDownload,
  IconFile,
  IconGlobe,
  IconSpark,
} from './Icons.jsx';
import StoreTests from './StoreTests.jsx';
import Platforms from './Platforms.jsx';
import PlatformCard from './PlatformCard.jsx';
import KeyFreeIntegrations from './KeyFreeIntegrations.jsx';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function BrowserApiUrl() {
  const [copied, setCopied] = useState(false);
  const url = window.location.origin;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="integration-url">
      <code title={url}>{url}</code>
      <button className="btn-small ghost" onClick={copy}>
        <IconCopy width={12} height={12} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function IntegrationCard({ icon, title, connected, statusText, description, steps, note, action }) {
  return (
    <div className={`integration ${connected ? 'connected' : ''}`}>
      <div className="integration-head">
        <span className="integration-icon">{icon}</span>
        <div className="integration-titles">
          <div className="integration-title">{title}</div>
          <div className="integration-status">
            {connected ? <IconCheck width={12} height={12} /> : <IconAlert width={12} height={12} />}
            {statusText}
          </div>
        </div>
      </div>
      <p className="integration-desc">{description}</p>
      {!connected && steps && (
        <ol className="integration-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {note}
      {action}
    </div>
  );
}

export default function RightPanel({
  session,
  files,
  integrations,
  onRefreshFiles,
  onRefreshIntegrations,
  tab,
  setTab,
  onClose,
}) {
  const [viewing, setViewing] = useState(null);
  const [copied, setCopied] = useState(false);

  async function openFile(path) {
    if (!session) return;
    try {
      const res = await fetch(
        `/api/sessions/${session.id}/file?path=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read file');
      setViewing({ path, content: data.content });
    } catch (err) {
      setViewing({ path, content: `Could not read file: ${err.message}` });
    }
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(viewing?.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <aside className="panel">
      <div className="panel-head">
        <div className="tabs">
          <button
            className={`tab ${tab === 'files' ? 'active' : ''}`}
            onClick={() => setTab('files')}
          >
            <IconFile width={13} height={13} />
            <span>Files</span>
          </button>
          <button
            className={`tab ${tab === 'integrations' ? 'active' : ''}`}
            onClick={() => setTab('integrations')}
          >
            <IconSpark width={13} height={13} />
            <span>Integrations</span>
          </button>
          <button
            className={`tab ${tab === 'stores' ? 'active' : ''}`}
            onClick={() => setTab('stores')}
          >
            <IconCheck width={13} height={13} />
            <span>Stores</span>
          </button>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close panel">
          <IconClose width={15} height={15} />
        </button>
      </div>

      {tab === 'files' ? (
        <div className="panel-body">
          <div className="files-toolbar">
            <span className="files-count">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            <div className="files-actions">
              <button className="icon-btn" onClick={onRefreshFiles} title="Refresh files">
                <IconFile width={14} height={14} />
              </button>
              {session && files.length > 0 && (
                <a
                  className="btn-small"
                  href={`/api/sessions/${session.id}/export.zip`}
                  download
                >
                  <IconDownload width={13} height={13} />
                  ZIP
                </a>
              )}
            </div>
          </div>

          {!session || files.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">
                <IconFile width={18} height={18} />
              </div>
              <div className="panel-empty-title">Workspace is empty</div>
              <p>
                Ask Orbit to build something — every file it writes shows up here, ready to
                download and open in VS Code.
              </p>
            </div>
          ) : (
            <div className="file-list">
              {files.map((file) => (
                <button key={file.path} className="file-row" onClick={() => openFile(file.path)}>
                  <IconFile width={13} height={13} />
                  <span className="file-path">{file.path}</span>
                  <span className="file-size">{formatSize(file.size)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'integrations' ? (
        <div className="panel-body">
          <div className="files-toolbar">
            <span className="files-count">Connections</span>
            <button className="btn-small ghost" onClick={onRefreshIntegrations}>
              Refresh
            </button>
          </div>

          <IntegrationCard
            icon={<IconSpark width={15} height={15} />}
            title="Orbit 1.2"
            connected={integrations?.engine?.connected}
            statusText={
              integrations?.engine?.connected
                ? 'Online · built in'
                : `Missing ${(integrations?.engine?.missing || ['CLOUDFLARE_API_KEY']).join(', ')}`
            }
            description="The agent behind every tool — workspace edits, GitHub, Hugging Face, VS Code and store checks. It plans, writes and verifies its own work."
            steps={[
              'Add an API token with AI access',
              'Set CLOUDFLARE_API_KEY and CLOUDFLARE_ACCOUNT_ID in the secrets panel',
            ]}
          />

          <IntegrationCard
            icon={<IconGlobe width={15} height={15} />}
            title="Orbit's computer"
            connected={integrations?.desktop?.configured}
            statusText={
              integrations?.desktop?.configured
                ? `${integrations?.desktop?.active || 0} sandbox${
                    (integrations?.desktop?.active || 0) === 1 ? '' : 'es'
                  } running · auto-stops after 3 min idle`
                : 'Missing E2B_API_KEY'
            }
            description="An isolated Linux desktop with Chromium that Orbit drives itself: open URLs, click, type, run terminal commands and take screenshots to check its own work. Sandboxes are killed after 3 minutes of inactivity or when a chat closes."
            steps={[
              'Create an API key at e2b.dev/dashboard',
              'Add E2B_API_KEY in the secrets panel',
            ]}
          />

          <IntegrationCard
            icon={<IconGlobe width={15} height={15} />}
            title="Your browser"
            connected={integrations?.browser?.connected}
            statusText={
              integrations?.browser?.connected
                ? 'Extension connected · every change needs your approval'
                : 'Extension not connected'
            }
            description="Orbit works in the tab you have open: it reads the page, clicks, types and navigates — with its cursor visible on your screen. Anything that changes the page waits for an approval card in the chat first."
            steps={[
              'Download the extension ZIP below and unzip it',
              'Open chrome://extensions, turn on Developer mode and choose Load unpacked → the folder holding manifest.json (the extension folder if you unzipped the GitHub repo)',
              'Open the Orbit extension popup, paste the API URL below and press Save & connect',
            ]}
            note={<BrowserApiUrl />}
            action={
              <a className="btn-small" href="/api/browser/extension.zip" download>
                <IconDownload width={13} height={13} />
                Extension ZIP
              </a>
            }
          />

          <KeyFreeIntegrations connected={integrations?.browser?.connected} />

          <PlatformCard />
          <Platforms />
        </div>
      ) : (
        <div className="panel-body">
          <StoreTests session={session} files={files} />
        </div>
      )}

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-path">{viewing.path}</span>
              <div className="modal-actions">
                <button className="icon-btn" onClick={copyContent} title="Copy contents">
                  {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                </button>
                <button className="icon-btn" onClick={() => setViewing(null)} title="Close">
                  <IconClose width={15} height={15} />
                </button>
              </div>
            </div>
            <pre className="modal-code">{viewing.content}</pre>
          </div>
        </div>
      )}
    </aside>
  );
}
