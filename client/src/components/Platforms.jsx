import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { IconCheck, IconAlert } from './Icons.jsx';

const MODE_LABEL = {
  connected: 'Connected',
  public: 'Public API',
  browser: 'Own browser',
  local: 'Local',
};

const MODE_TITLE = {
  connected: 'Token present — private and write actions unlocked',
  public: 'Public API answers anonymous reads — no token needed',
  browser: "Orbit reads it in its own browser — no token needed",
  local: 'Available locally',
};

function groupByCategory(platforms) {
  const groups = new Map();
  for (const platform of platforms) {
    if (!groups.has(platform.category)) groups.set(platform.category, []);
    groups.get(platform.category).push(platform);
  }
  return [...groups.entries()];
}

export default function Platforms() {
  const [platforms, setPlatforms] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const data = await api.platforms(refresh);
      setPlatforms(data.platforms);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return platforms;
    return platforms.filter((platform) =>
      `${platform.name} ${platform.category} ${platform.blurb} ${platform.id}`
        .toLowerCase()
        .includes(needle)
    );
  }, [platforms, query]);

  const groups = useMemo(() => groupByCategory(visible), [visible]);
  const connected = platforms.filter((platform) => platform.connected).length;
  const reachable = platforms.filter((platform) => platform.reachable !== false).length;

  return (
    <div className="platforms">
      <div className="platforms-toolbar">
        <input
          className="platform-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search platforms"
          aria-label="Search platforms"
        />
        <button className="btn-small ghost" onClick={() => load(true)} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      <div className="platforms-meta">
        <strong>{platforms.length}</strong> platforms · {reachable} reachable · {connected} with a
        token · <span className="platforms-note">no tokens needed</span>
      </div>

      {error && <div className="muted-note">{error}</div>}

      {!loading && !visible.length && (
        <div className="muted-note">No platform matches “{query.trim()}”.</div>
      )}

      {groups.map(([category, items]) => (
        <section key={category} className="platform-group">
          <h3 className="platform-group-title">
            {category}
            <span>{items.length}</span>
          </h3>
          {items.map((platform) => (
            <div className={`platform ${platform.mode}`} key={platform.id}>
              <div className="platform-main">
                <div className="platform-name">{platform.name}</div>
                <p className="platform-blurb">{platform.blurb}</p>
              </div>
              <div className="platform-side">
                <span
                  className={`platform-pill ${platform.mode}${
                    platform.reachable === false ? ' unreachable' : ''
                  }`}
                  title={
                    platform.reachable === false
                      ? `Not answering right now${platform.checked ? ` (${platform.checked})` : ''}`
                      : MODE_TITLE[platform.mode] || 'Available without a token'
                  }
                >
                  {platform.reachable === false ? (
                    <IconAlert width={11} height={11} />
                  ) : (
                    <IconCheck width={11} height={11} />
                  )}
                  {MODE_LABEL[platform.mode] || platform.mode}
                </span>
                <a className="platform-docs" href={platform.docs} target="_blank" rel="noreferrer">
                  Docs
                </a>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
