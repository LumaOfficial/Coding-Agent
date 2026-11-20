import { useState } from 'react';
import {
  IconChevron,
  IconFile,
  IconGear,
  IconGithub,
  IconGlobe,
  IconPanel,
  IconSpark,
  IconTerminal,
} from './Icons.jsx';

const STEPS = [
  {
    eyebrow: 'Step 1 of 3',
    title: 'Welcome to Orbit',
    sub: 'One agent that writes, fixes and ships code with you — right here in the browser.',
  },
  {
    eyebrow: 'Step 2 of 3',
    title: 'What Orbit can do',
    sub: 'Every capability lives in one Tools menu. Ask in plain language and it picks the right one.',
  },
  {
    eyebrow: 'Step 3 of 3',
    title: 'A few good habits',
    sub: 'Orbit works inside a private workspace per session, so nothing touches your machine.',
  },
];

const SKILLS = [
  { icon: IconFile, label: 'Workspace files', hint: 'Write, read and fix project files.' },
  { icon: IconGithub, label: 'GitHub', hint: 'Browse repos, commit and open pull requests.' },
  { icon: IconGlobe, label: 'Web research', hint: 'Search and read pages to ground answers.' },
  { icon: IconTerminal, label: 'Linux desktop', hint: 'An isolated machine with a real browser.' },
  { icon: IconPanel, label: 'Store checks', hint: 'Test what your app needs to be published.' },
  { icon: IconGear, label: 'VS Code', hint: 'Export any workspace as a ZIP to keep coding.' },
];

const TIPS = [
  'Describe the outcome, not the steps — “fix the login bug” works.',
  'Anything risky (deleting files, pushing code) waits for your approval.',
  'Each session has its own files; export a ZIP when you want them locally.',
];

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onb-backdrop">
      <div className="onb-card" role="dialog" aria-modal="true" aria-label="Welcome to Orbit">
        <div className="onb-head">
          <span className="onb-mark">
            <span className="mark-orbit" aria-hidden="true" />
            <IconSpark width={18} height={18} />
          </span>
          <span className="onb-eyebrow">{current.eyebrow}</span>
        </div>

        <h1 className="onb-title">{current.title}</h1>
        <p className="onb-sub">{current.sub}</p>

        {step === 1 && (
          <div className="onb-skills">
            {SKILLS.map(({ icon: Icon, label, hint }) => (
              <div className="onb-skill" key={label}>
                <span className="onb-skill-icon">
                  <Icon width={14} height={14} />
                </span>
                <span className="onb-skill-text">
                  <span className="onb-skill-label">{label}</span>
                  <span className="onb-skill-hint">{hint}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {last && (
          <ul className="onb-tips">
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}

        <div className="onb-foot">
          <div className="onb-dots" aria-hidden="true">
            {STEPS.map((s, index) => (
              <span key={s.title} className={index === step ? 'active' : ''} />
            ))}
          </div>
          <div className="onb-actions">
            {!last && (
              <button type="button" className="btn-small ghost" onClick={finish} disabled={busy}>
                Skip tour
              </button>
            )}
            <button
              type="button"
              className="btn-small"
              disabled={busy}
              onClick={last ? finish : () => setStep(step + 1)}
            >
              {last ? 'Start building' : 'Next'}
              {!last && <IconChevron width={13} height={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
