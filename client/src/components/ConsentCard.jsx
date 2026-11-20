import { IconCheck, IconClose, IconAlert } from './Icons.jsx';

const RISK_LABEL = {
  write: 'Writes a file',
  destructive: 'Deletes',
  shell: 'Runs a command',
  external: 'Changes an external service',
};

/**
 * The consent card. Orbit asks before anything with a real side effect:
 * deleting or overwriting a workspace file, writing to GitHub and running a
 * shell command on its own computer.
 */
export default function ConsentCard({ request, onApprove, busy = false }) {
  if (!request) return null;

  return (
    <div className="browser-card consent-card" role="alertdialog" aria-label={request.title}>
      <div className="browser-card-head">
        <span className="browser-card-icon">
          <IconAlert width={15} height={15} />
        </span>
        <div className="browser-card-titles">
          <div className="browser-card-title">{request.title}</div>
          <div className="browser-card-summary">
            <span className={`consent-risk ${request.risk || 'write'}`}>
              {RISK_LABEL[request.risk] || 'Needs consent'}
            </span>
            {request.summary}
          </div>
        </div>
      </div>
      {request.detail && <p className="browser-card-detail">{request.detail}</p>}
      <div className="browser-card-actions">
        <button className="btn-small ghost" onClick={() => onApprove(false)} disabled={busy}>
          <IconClose width={12} height={12} />
          Decline
        </button>
        <button className="btn-small primary" onClick={() => onApprove(true)} disabled={busy}>
          <IconCheck width={12} height={12} />
          Allow
        </button>
      </div>
    </div>
  );
}
