import { useState } from 'react';
import {
  IconAlert,
  IconCheck,
  IconClose,
  IconCopy,
  IconDownload,
  IconFile,
  IconGithub,
  IconSpark,
  IconTerminal,
} from './Icons.jsx';

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

  const github = integrations?.github;
  const hf = integrations?.huggingface;
  const groq = integrations?.groq;

  return (
    <aside className="panel">
      <div className="panel-head">
        <div className="tabs">
          <button
            className={`tab ${tab === 'files' ? 'active' : ''}`}
            onClick={() => setTab('files')}
          >
            Workspace
          </button>
          <button
            className={`tab ${tab === 'integrations' ? 'active' : ''}`}
            onClick={() => setTab('integrations')}
          >
            Integrations
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
      ) : (
        <div className="panel-body">
          <div className="files-toolbar">
            <span className="files-count">Connections</span>
            <button className="btn-small ghost" onClick={onRefreshIntegrations}>
              Refresh
            </button>
          </div>

          <IntegrationCard
            icon={<IconSpark width={15} height={15} />}
            title="Groq"
            connected={groq?.connected}
            statusText={groq?.connected ? 'API key active' : 'Key required'}
            description="Runs the agent. Every reply and tool call is generated by a Groq-hosted model."
            steps={[
              'Create a key at console.groq.com/keys',
              'Add it as GROQ_API_KEY in the secrets panel',
            ]}
            action={
              <a
                className="btn-small ghost"
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
              >
                Open Groq console
              </a>
            }
          />

          <IntegrationCard
            icon={<IconGithub width={15} height={15} />}
            title="GitHub"
            connected={github?.connected}
            statusText={
              github?.connected
                ? `Signed in as ${github.login}`
                : github?.error || 'Public read only'
            }
            description="Browses and reads public repos with no token. Add a token to commit to branches and open pull requests."
            steps={[
              'Optional: create a fine-grained or classic token with repo scope',
              'Add it as GITHUB_TOKEN to unlock commits and pull requests',
            ]}
            action={
              <a
                className="btn-small ghost"
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer"
              >
                Create token
              </a>
            }
          />

          <IntegrationCard
            icon={<IconSpark width={15} height={15} />}
            title="Hugging Face"
            connected={hf?.connected}
            statusText={hf?.connected ? `Signed in as ${hf.name}` : 'Public search only'}
            description="Searches models, datasets and spaces. A token unlocks private repos and higher rate limits."
            steps={[
              'Create a read token at huggingface.co/settings/tokens',
              'Add it as HF_TOKEN in the secrets panel',
            ]}
            action={
              <a
                className="btn-small ghost"
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
              >
                Create token
              </a>
            }
          />

          <div className="integration">
            <div className="integration-head">
              <span className="integration-icon">
                <IconTerminal width={15} height={15} />
              </span>
              <div className="integration-titles">
                <div className="integration-title">VS Code</div>
                <div className="integration-status">
                  <IconCheck width={12} height={12} />
                  Export available
                </div>
              </div>
            </div>
            <p className="integration-desc">
              Download the workspace as a ZIP, unzip it, then open the folder (or the{' '}
              <code>.code-workspace</code> file) in VS Code.
            </p>
            {session && files.length > 0 ? (
              <a className="btn-small" href={`/api/sessions/${session.id}/export.zip`} download>
                <IconDownload width={13} height={13} />
                Download workspace
              </a>
            ) : (
              <span className="muted-note">No files to export yet.</span>
            )}
          </div>
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
