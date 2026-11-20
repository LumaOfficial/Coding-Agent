import { useEffect } from 'react';
import { ACCENTS } from '../lib/settings.js';
import { IconClose, IconGear } from './Icons.jsx';

function Toggle({ label, hint, value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={`set-row ${value ? 'on' : ''}`}
      onClick={() => onChange(!value)}
    >
      <span className="set-text">
        <span className="set-label">{label}</span>
        {hint ? <span className="set-hint">{hint}</span> : null}
      </span>
      <span className="set-switch">
        <span />
      </span>
    </button>
  );
}

function Choice({ label, hint, value, options, onChange }) {
  return (
    <div className="set-row static">
      <span className="set-text">
        <span className="set-label">{label}</span>
        {hint ? <span className="set-hint">{hint}</span> : null}
      </span>
      <div className="set-choice">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="settings-group">
      <div className="settings-group-title">{title}</div>
      {children}
    </section>
  );
}

export default function SettingsPanel({ open, settings, onChange, onReset, onClose, user }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-head">
          <span className="settings-head-mark">
            <IconGear width={15} height={15} />
          </span>
          <div className="settings-head-text">
            <span className="settings-title">Settings</span>
            <span className="settings-version">Orbit 1.2{user?.email ? ` · ${user.email}` : ''}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings" title="Close">
            <IconClose width={15} height={15} />
          </button>
        </header>

        <div className="settings-body">
          <Group title="Appearance">
            <Toggle
              label="Ambient effects"
              hint="Aurora, stars, meteors and drifting dust behind the app."
              value={settings.ambient}
              onChange={(value) => onChange({ ambient: value })}
            />
            <Toggle
              label="Pointer glow"
              hint="A soft spotlight that follows your cursor."
              value={settings.spotlight}
              onChange={(value) => onChange({ spotlight: value })}
            />
            <Toggle
              label="Animations"
              hint="Entrance motion, hover transitions and pulsing accents."
              value={settings.motion}
              onChange={(value) => onChange({ motion: value })}
            />
            <Choice
              label="Density"
              hint="How tightly conversations and cards are packed."
              value={settings.density}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
              onChange={(value) => onChange({ density: value })}
            />
            <div className="set-row static">
              <span className="set-text">
                <span className="set-label">Accent</span>
                <span className="set-hint">The highlight color used across buttons and borders.</span>
              </span>
              <div className="set-swatches">
                {Object.entries(ACCENTS).map(([key, palette]) => (
                  <button
                    key={key}
                    type="button"
                    className={`set-swatch ${settings.accent === key ? 'active' : ''}`}
                    style={{ '--sw': palette.accent }}
                    aria-label={palette.label}
                    title={palette.label}
                    onClick={() => onChange({ accent: key })}
                  />
                ))}
              </div>
            </div>
            <Toggle
              label="Wrap long code"
              hint="Let code blocks wrap instead of scrolling sideways."
              value={settings.wrapCode}
              onChange={(value) => onChange({ wrapCode: value })}
            />
            <Toggle
              label="Background grid"
              hint="The faint dot grid behind the conversation."
              value={settings.grid}
              onChange={(value) => onChange({ grid: value })}
            />
            <Toggle
              label="Solid surfaces"
              hint="Drop the frosted blur for flat, fully opaque panels."
              value={settings.solidSurfaces}
              onChange={(value) => onChange({ solidSurfaces: value })}
            />
            <Choice
              label="Text size"
              hint="How large messages and the composer read."
              value={settings.textSize}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'large', label: 'Large' },
              ]}
              onChange={(value) => onChange({ textSize: value })}
            />
          </Group>

          <Group title="Chat">
            <Toggle
              label="Cosmic thinking phrases"
              hint="Stargazing… and friends for long tasks. Off means a plain “Thinking…”."
              value={settings.cosmicThinking}
              onChange={(value) => onChange({ cosmicThinking: value })}
            />
            <Toggle
              label="Thinking dots"
              hint="The three bouncing dots while Orbit waits on the model."
              value={settings.thinkingDots}
              onChange={(value) => onChange({ thinkingDots: value })}
            />
            <Toggle
              label="Live status"
              hint="Show the running tool or thinking state under the session title."
              value={settings.showStatus}
              onChange={(value) => onChange({ showStatus: value })}
            />
            <Toggle
              label="Tool activity cards"
              hint="Show every tool Orbit runs, with its arguments and result."
              value={settings.showTools}
              onChange={(value) => onChange({ showTools: value })}
            />
            <Toggle
              label="Auto-scroll"
              hint="Follow new messages as they stream in."
              value={settings.autoScroll}
              onChange={(value) => onChange({ autoScroll: value })}
            />
            <Toggle
              label="Send with Enter"
              hint="Off: Enter adds a new line and Ctrl/⌘ + Enter sends."
              value={settings.enterToSend}
              onChange={(value) => onChange({ enterToSend: value })}
            />
            <Toggle
              label="Message timestamps"
              hint="Show the time each message was sent beside its label."
              value={settings.timestamps}
              onChange={(value) => onChange({ timestamps: value })}
            />
            <Toggle
              label="Starter chips"
              hint="The quick capability tags on the empty conversation screen."
              value={settings.starters}
              onChange={(value) => onChange({ starters: value })}
            />
            <Toggle
              label="Expand tool details"
              hint="Open every tool card's input and output by default."
              value={settings.expandTools}
              onChange={(value) => onChange({ expandTools: value })}
            />
          </Group>

          <Group title="Agent">
            <Toggle
              label="Auto-fix workspace"
              hint="Apply safe fixes automatically after every turn."
              value={settings.autoFix}
              onChange={(value) => onChange({ autoFix: value })}
            />
            <Toggle
              label="Rest when idle"
              hint="Drift off to sleep with little Z's when you stop typing."
              value={settings.idleSleep}
              onChange={(value) => onChange({ idleSleep: value })}
            />
          </Group>

          <Group title="About">
            <div className="set-row static">
              <span className="set-text">
                <span className="set-label">Orbit 1.2</span>
                <span className="set-hint">
                  An AI agent that operates your workspace, GitHub, Hugging Face and more.
                </span>
              </span>
              <span className="settings-badge">1.2</span>
            </div>
          </Group>
        </div>

        <footer className="settings-foot">
          <button type="button" className="btn-small ghost" onClick={onReset}>
            Reset to defaults
          </button>
          <button type="button" className="btn-small" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
