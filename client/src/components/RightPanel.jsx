import { useState } from 'react';
import {
  IconAlert,
  IconCheck,
  IconClose,
  IconCopy,
  IconDownload,
  IconFile,
  IconSpark,
} from './Icons.jsx';
import StoreTests from './StoreTests.jsx';
import Platforms from './Platforms.jsx';
import PlatformCard from './PlatformCard.jsx';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function IntegrationCard({ icon, title, connected, statusText, description, steps, action }) {
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
                Ask Forge to build something — every file it writes shows up here, ready to
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
            title="Gemma 4"
            connected={integrations?.engine?.connected}
            statusText={
              integrations?.engine?.connected
                ? 'Cloudflare Workers AI · locked'
                : `Missing ${(integrations?.engine?.missing || ['CLOUDFLARE_API_KEY']).join(', ')}`
            }
            description="The only model this app runs: @cf/google/gemma-4-26b-a4b-it on Cloudflare Workers AI. It drives the local tools — workspace edits, GitHub, Hugging Face, VS Code and store checks."
            steps={[
              'Create a Cloudflare API token with Workers AI access',
              'Add CLOUDFLARE_API_KEY and CLOUDFLARE_ACCOUNT_ID in the secrets panel',
            ]}
          />

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
