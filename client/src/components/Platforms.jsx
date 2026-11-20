import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { IconCheck, IconAlert } from './Icons.jsx';

const MODE_LABEL = {
  connected: 'Connected',
  public: 'Public read',
  local: 'Local',
  token: 'Add token',
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

  const load = useCallback(async () => {
    try {
      const data = await api.platforms();
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
  const readable = platforms.filter((platform) => platform.readable).length;

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
        <button className="btn-small ghost" onClick={load} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      <div className="platforms-meta">
        <strong>{platforms.length}</strong> platforms · {connected} connected · {readable} readable
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
                  className={`platform-pill ${platform.mode}`}
                  title={
                    platform.mode === 'token'
                      ? `Add ${platform.env.join(', ')} to the app secrets`
                      : platform.mode === 'connected'
                        ? 'Credentials are present'
                        : platform.mode === 'public'
                          ? 'Works without a token'
                          : 'Available locally'
                  }
                >
                  {platform.mode === 'connected' ? (
                    <IconCheck width={11} height={11} />
                  ) : (
                    <IconAlert width={11} height={11} />
                  )}
                  {MODE_LABEL[platform.mode]}
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
