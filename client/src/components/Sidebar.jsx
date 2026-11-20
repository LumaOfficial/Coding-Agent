import { IconGear, IconLogout, IconPlus, IconSpark, IconTrash } from './Icons.jsx';

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
  idle = 'awake',
  user = null,
  onSignOut,
  onOpenSettings,
}) {
  const github = integrations?.github;
  const hf = integrations?.huggingface;
  const engine = integrations?.engine;
  const githubOk = github?.connected || github?.ok;
  const hfOk = hf?.connected || hf?.ok;
  const engineOk = Boolean(engine?.connected);

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <IconSpark width={17} height={17} />
          </div>
          <div>
            <div className="brand-name">Orbit 1.2</div>
            <div className="brand-sub">
              {idle === 'awake'
                ? 'AI agent · operates your stack'
                : idle === 'asleep'
                  ? 'snoring softly · zzz'
                  : 'resting · zzz'}
            </div>
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
            <div className="session-empty">No sessions yet. Ask Orbit to build something.</div>
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
          <button className="settings-link" onClick={onOpenSettings}>
            <IconGear width={14} height={14} />
            Settings
          </button>
          {user && (
            <div className="user-row">
              <span className="user-avatar">
                {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="user-text">
                <div className="user-name">{user.name || 'Signed in'}</div>
                <div className="user-email">{user.email}</div>
              </div>
              <button
                className="icon-btn user-signout"
                title="Sign out"
                aria-label="Sign out"
                onClick={onSignOut}
              >
                <IconLogout width={15} height={15} />
              </button>
            </div>
          )}
          <div className="status-row">
            <StatusDot ok={engineOk} />
            <span>Engine</span>
            <span className="status-value">
              {engineOk
                ? 'Orbit 1.2 · online'
                : `Orbit 1.2 · ${engine?.missing?.length ? 'add key' : 'offline'}`}
            </span>
          </div>
          <div className="status-row">
            <StatusDot ok />
            <span>Web</span>
            <span className="status-value">own browser · online</span>
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
