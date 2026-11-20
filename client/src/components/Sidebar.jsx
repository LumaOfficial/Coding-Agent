import { IconPlus, IconSpark, IconTrash } from './Icons.jsx';

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatusDot({ ok }) {
  return <span className={`status-dot ${ok ? 'ok' : ''}`} />;
}

export default function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  integrations,
  open,
  onClose,
}) {
  const github = integrations?.github;
  const hf = integrations?.huggingface;
  const githubOk = github?.connected || github?.ok;
  const hfOk = hf?.connected || hf?.ok;

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <IconSpark width={17} height={17} />
          </div>
          <div>
            <div className="brand-name">Forge</div>
            <div className="brand-sub">Local auto-fix agent</div>
          </div>
        </div>

        <div className="sidebar-actions">
          <button className="btn-new" onClick={onNew}>
            <IconPlus width={15} height={15} />
            New session
          </button>
        </div>

        <div className="sidebar-section-label">
          Sessions
          <span className="session-count">{sessions.length}</span>
        </div>

        <div className="session-list">
          {sessions.length === 0 && (
            <div className="session-empty">No sessions yet. Ask Forge to build something.</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(s.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(s.id)}
            >
              <div className="session-text">
                <div className="session-title">{s.title}</div>
                <div className="session-meta">
                  {relativeTime(s.updated_at)}
                  {s.messageCount ? ` · ${s.messageCount} msgs` : ''}
                </div>
              </div>
              <button
                className="icon-btn session-delete"
                title="Delete session"
                onClick={(e) => onDelete(s.id, e)}
              >
                <IconTrash width={14} height={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="status-row">
            <StatusDot ok />
            <span>Engine</span>
            <span className="status-value">local · no key</span>
          </div>
          <div className="status-row">
            <StatusDot ok={githubOk} />
            <span>GitHub</span>
            <span className="status-value">
              {github?.connected
                ? github.login
                : githubOk
                  ? 'read only · no token'
                  : github?.error || 'offline'}
            </span>
          </div>
          <div className="status-row">
            <StatusDot ok={hfOk} />
            <span>Hugging Face</span>
            <span className="status-value">
              {hf?.connected ? 'connected' : hfOk ? 'public · no token' : hf?.error || 'offline'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
