import { IconCheck, IconClose, IconGlobe } from './Icons.jsx';

/**
 * The permission card. Orbit asks before anything that changes the page in
 * the user's own browser — navigating, clicking, typing, keys and scrolling.
 */
export default function BrowserCard({ request, onApprove, busy = false }) {
  if (!request) return null;

  return (
    <div className="browser-card" role="alertdialog" aria-label="Orbit wants to act in your browser">
      <div className="browser-card-head">
        <span className="browser-card-icon">
          <IconGlobe width={15} height={15} />
        </span>
        <div className="browser-card-titles">
          <div className="browser-card-title">Allow Orbit to operate in your browser?</div>
          <div className="browser-card-summary">{request.summary}</div>
        </div>
      </div>
      {request.detail && <p className="browser-card-detail">{request.detail}</p>}
      {request.url && <p className="browser-card-url">{request.url}</p>}
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
