import { useState } from 'react';
import { IconAlert, IconCheck, IconSpark } from './Icons.jsx';

function fileName(path) {
  return path.split('/').pop();
}

/**
 * Always-on workspace scan. Runs by itself whenever files change and offers
 * the safe edits without the user having to ask for a fix.
 */
export default function ScanCard({ scan, scanning, autoFix, onToggleAuto, onApply }) {
  const [open, setOpen] = useState(false);

  if (!scan && !scanning) return null;

  const applied = scan?.applied || [];
  const fixes = scan?.fixes || [];
  const issues = scan?.issues || [];
  const checked = scan?.checked || 0;

  if (!scanning && checked === 0 && !applied.length) return null;

  const total = applied.length + fixes.length;
  let tone = 'clean';
  let title = 'Scanning workspace…';

  if (scanning && !scan) {
    tone = 'busy';
  } else if (applied.length) {
    tone = issues.length ? 'warn' : 'ok';
    title = `${autoFix ? 'Auto-fixed' : 'Fixed'} ${applied.length} file${
      applied.length === 1 ? '' : 's'
    }`;
    if (issues.length) title += ` · ${issues.length} left to review`;
  } else if (fixes.length) {
    tone = 'warn';
    title = `${fixes.length} file${fixes.length === 1 ? '' : 's'} can be fixed automatically`;
  } else if (issues.length) {
    tone = 'warn';
    title = `${issues.length} problem${issues.length === 1 ? '' : 's'} found`;
  } else {
    title = `Scanned ${checked} file${checked === 1 ? '' : 's'} · nothing to fix`;
  }

  return (
    <div className={`scan-card ${tone}`}>
      <div className="scan-head">
        <span className="scan-icon">
          {tone === 'clean' || tone === 'ok' ? (
            <IconCheck width={13} height={13} />
          ) : (
            <IconAlert width={13} height={13} />
          )}
        </span>
        <span className="scan-title">{title}</span>

        <div className="scan-actions">
          {fixes.length > 0 && (
            <button className="btn-small" onClick={onApply} disabled={scanning}>
              {scanning ? 'Fixing…' : `Fix ${total > fixes.length ? 'all' : 'now'}`}
            </button>
          )}
          {(total > 0 || issues.length > 0) && (
            <button
              className="btn-small ghost"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              {open ? 'Hide' : 'Review'}
            </button>
          )}
          <label className="scan-toggle" title="Apply safe fixes automatically">
            <input type="checkbox" checked={autoFix} onChange={onToggleAuto} />
            <span>Auto</span>
          </label>
        </div>
      </div>

      {open && (
        <div className="scan-detail">
          {applied.length > 0 && (
            <>
              <div className="scan-section">Applied automatically</div>
              {applied.map((fix) => (
                <div key={`applied-${fix.path}`} className="scan-row">
                  <IconCheck width={12} height={12} />
                  <span className="scan-path">{fileName(fix.path)}</span>
                  <span className="scan-note">{fix.changes.join(', ')}</span>
                </div>
              ))}
            </>
          )}

          {fixes.length > 0 && (
            <>
              <div className="scan-section">Suggested edits</div>
              {fixes.map((fix) => (
                <div key={`fix-${fix.path}`} className="scan-row">
                  <IconSpark width={12} height={12} />
                  <span className="scan-path">{fileName(fix.path)}</span>
                  <span className="scan-note">{fix.changes.join(', ')}</span>
                </div>
              ))}
            </>
          )}

          {issues.length > 0 && (
            <>
              <div className="scan-section">Needs a look</div>
              {issues.slice(0, 12).map((issue, index) => (
                <div key={`issue-${index}`} className="scan-row">
                  <IconAlert width={12} height={12} />
                  <span className="scan-path">
                    {fileName(issue.path)}
                    {issue.line ? `:${issue.line}` : ''}
                  </span>
                  <span className="scan-note">{issue.message}</span>
                </div>
              ))}
            </>
          )}

          {!applied.length && !fixes.length && !issues.length && (
            <div className="scan-row">
              <IconCheck width={12} height={12} />
              <span className="scan-note">No syntax errors, broken imports or formatting issues.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
