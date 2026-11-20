import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { IconAlert, IconCheck, IconFile, IconSpark } from './Icons.jsx';

const STATUS_LABEL = {
  ready: 'Ready',
  'needs-work': 'Warnings',
  blocked: 'Missing items',
};

function StatusDot({ status }) {
  return <span className={`store-dot ${status}`} />;
}

function TargetCard({ target }) {
  const [open, setOpen] = useState(false);
  const visible = target.checks.filter((item) => item.status !== 'pass');
  const passing = target.checks.length - visible.length;

  return (
    <div className={`store-card ${target.status}`}>
      <button className="store-card-head" onClick={() => setOpen((value) => !value)}>
        <StatusDot status={target.status} />
        <span className="store-name">{target.name}</span>
        <span className="store-score">{target.score}</span>
      </button>

      <div className="store-counts">
        <span className={target.counts.fail ? 'bad' : 'good'}>
          {target.counts.fail ? `${target.counts.fail} missing` : 'nothing missing'}
        </span>
        <span className="dot-sep">·</span>
        <span className={target.counts.warn ? 'warn' : 'good'}>
          {target.counts.warn} warning{target.counts.warn === 1 ? '' : 's'}
        </span>
        <span className="dot-sep">·</span>
        <span className="good">{target.counts.pass} passing</span>
      </div>

      {open && (
        <div className="store-checks">
          {visible.map((item) => (
            <div key={item.id} className={`store-check ${item.status}`}>
              <IconAlert width={12} height={12} />
              <div>
                <div className="store-check-label">{item.label}</div>
                {item.detail && <div className="store-check-detail">{item.detail}</div>}
              </div>
            </div>
          ))}
          {!visible.length && (
            <div className="store-check pass">
              <IconCheck width={12} height={12} />
              <div className="store-check-label">Every check passes.</div>
            </div>
          )}
          {passing > 0 && (
            <div className="store-check pass">
              <IconCheck width={12} height={12} />
              <div className="store-check-label">
                {passing} check{passing === 1 ? '' : 's'} passing
              </div>
            </div>
          )}
          <a className="store-docs" href={target.docs} target="_blank" rel="noreferrer">
            Store requirements
          </a>
        </div>
      )}
    </div>
  );
}

export default function StoreTests({ session, files }) {
  const [targets, setTargets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const autoRan = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.stores();
        if (cancelled) return;
        setTargets(data.targets);
        setSelected(data.targets.map((target) => target.id));
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || !targets.length || !files.length) return;
    if (autoRan.current === session.id) return;
    autoRan.current = session.id;
    runTests(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, targets.length, files.length]);

  async function runTests(ids) {
    if (!session || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.storeTests(session.id, ids && ids.length ? ids : undefined);
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  if (!session) {
    return (
      <div className="panel-empty">
        <div className="panel-empty-icon">
          <IconFile width={18} height={18} />
        </div>
        <div className="panel-empty-title">No workspace yet</div>
        <p>Start a session and add project files, then test them against the stores.</p>
      </div>
    );
  }

  return (
    <div className="store-panel">
      <div className="files-toolbar">
        <span className="files-count">
          {report
            ? `${report.totals.fails} missing · ${report.totals.warns} warnings`
            : `${files.length} file${files.length === 1 ? '' : 's'} to test`}
        </span>
        <button
          className="btn-small"
          onClick={() => runTests(selected)}
          disabled={loading || !files.length || !selected.length}
        >
          {loading ? 'Testing…' : 'Run tests'}
        </button>
      </div>

      <div className="store-chips">
        {targets.map((target) => (
          <button
            key={target.id}
            className={`store-chip ${selected.includes(target.id) ? 'active' : ''}`}
            onClick={() => toggle(target.id)}
            title={target.docs}
          >
            {target.name}
          </button>
        ))}
      </div>

      {error && (
        <div className="store-error">
          <IconAlert width={13} height={13} />
          {error}
        </div>
      )}

      {!files.length && (
        <div className="panel-empty">
          <div className="panel-empty-icon">
            <IconSpark width={18} height={18} />
          </div>
          <div className="panel-empty-title">Workspace is empty</div>
          <p>
            Add the extension, app or package files first — the tests read the real files and
            report what each store still needs.
          </p>
        </div>
      )}

      {files.length > 0 && !report && !loading && (
        <div className="muted-note store-hint">Pick the stores and run the tests.</div>
      )}

      {report && (
        <div className="store-report">
          {report.targets.map((target) => (
            <TargetCard key={target.id} target={target} />
          ))}
          <div className="store-totals">
            {report.totals.ready} ready · {report.totals.blocked} blocked ·{' '}
            {report.workspace_files} file{report.workspace_files === 1 ? '' : 's'} scanned
          </div>
        </div>
      )}
    </div>
  );
}
