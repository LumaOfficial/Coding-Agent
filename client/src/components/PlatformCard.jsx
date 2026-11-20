import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconGlobe } from './Icons.jsx';

/**
 * What the agent actually runs on, next to what the visitor is browsing from.
 * Server detection probes the sandbox; the browser half comes from the UA of
 * this request, so both halves are labelled instead of blended.
 */
export default function PlatformCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .platform()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="integration">
        <div className="integration-head">
          <span className="integration-icon">
            <IconGlobe width={15} height={15} />
          </span>
          <div className="integration-titles">
            <div className="integration-title">Platform detector</div>
            <div className="integration-status">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const tools = Object.entries(data?.tools || {})
    .filter(([, version]) => version)
    .map(([name]) => name);
  const browser = data?.client?.browser;
  const browserOs = data?.client?.os;
  const runtime = data
    ? `${data.container ? `${data.container} container` : 'host'} · ${
        data.os?.pretty || data.host?.platform || 'unknown'
      } · node ${data.runtime?.node || '?'}`
    : 'Detecting…';

  const facts = [
    ['Your browser', browser ? `${browser}${browserOs ? ` on ${browserOs}` : ''}` : 'detecting'],
    ['Agent runtime', runtime],
    [
      'Repository',
      data?.git?.repo
        ? `${data.git.branch || 'detached'}${data.git.dirty ? ' · uncommitted changes' : ''}`
        : 'no git repo',
    ],
    ['Installed tools', tools.length ? tools.join(', ') : 'probing…'],
    ['Web access', data ? 'own browser · search and fetch online' : 'checking…'],
  ];

  return (
    <div className="integration">
      <div className="integration-head">
        <span className="integration-icon">
          <IconGlobe width={15} height={15} />
        </span>
        <div className="integration-titles">
          <div className="integration-title">Platform detector</div>
          <div className="integration-status">
            {data ? 'Live from the running agent' : 'Probing the runtime…'}
          </div>
        </div>
      </div>
      <div className="platform-facts">
        {facts.map(([label, value]) => (
          <div className="fact-row" key={label}>
            <span className="fact-label">{label}</span>
            <span className="fact-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
