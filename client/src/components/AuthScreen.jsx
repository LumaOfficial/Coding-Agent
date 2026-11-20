import { useState } from 'react';
import { api } from '../api.js';
import Ambient from './Ambient.jsx';
import { IconSpark } from './Icons.jsx';

export function AuthBoot() {
  return (
    <div className="auth">
      <Ambient level="awake" />
      <div className="auth-boot">
        <div className="brand-mark">
          <IconSpark width={18} height={18} />
        </div>
        <span>Waking Orbit…</span>
      </div>
    </div>
  );
}

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signup = mode === 'signup';

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = signup
        ? await api.signup({ name, email, password })
        : await api.login({ email, password });
      onAuthed(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  return (
    <div className="auth">
      <Ambient level="awake" />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <IconSpark width={18} height={18} />
          </div>
          <span>Orbit</span>
        </div>

        <h1 className="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-sub">
          {signup
            ? 'One account keeps your sessions, files and integrations together.'
            : 'Sign in to pick up your workspace where you left it.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            aria-selected={!signup}
            className={`auth-tab ${!signup ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={signup}
            className={`auth-tab ${signup ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {signup && (
            <label className="auth-field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
                maxLength={60}
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={signup ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={signup ? 'At least 8 characters' : 'Your password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
            />
          </label>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-note">You stay signed in on this device for 30 days.</p>
      </div>
    </div>
  );
}
