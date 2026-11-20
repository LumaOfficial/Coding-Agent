import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'orbit.settings.v1';

/** Every preference the app exposes, with the value it ships with. */
export const DEFAULT_SETTINGS = {
  // Appearance
  ambient: true,
  spotlight: true,
  motion: true,
  density: 'comfortable',
  accent: 'violet',
  wrapCode: false,

  // Chat
  cosmicThinking: true,
  thinkingDots: true,
  autoScroll: true,
  enterToSend: true,
  showStatus: true,
  showTools: true,

  // Agent
  autoFix: true,
  idleSleep: true,
};

/** Accent palettes offered in Settings. */
export const ACCENTS = {
  violet: {
    label: 'Violet',
    accent: '#8b6cff',
    ink: '#c3b4ff',
    soft: 'rgba(139, 108, 255, 0.18)',
    grad: 'linear-gradient(135deg, #a78bfa 0%, #7c7cff 48%, #58d5ff 100%)',
  },
  ice: {
    label: 'Ice',
    accent: '#4fb8ff',
    ink: '#a8dcff',
    soft: 'rgba(79, 184, 255, 0.18)',
    grad: 'linear-gradient(135deg, #7dd3fc 0%, #4fb8ff 50%, #7c7cff 100%)',
  },
  mint: {
    label: 'Mint',
    accent: '#3fdc9c',
    ink: '#9df0cd',
    soft: 'rgba(63, 220, 156, 0.18)',
    grad: 'linear-gradient(135deg, #6ee7b7 0%, #3fdc9c 50%, #58d5ff 100%)',
  },
  amber: {
    label: 'Amber',
    accent: '#ffb35c',
    ink: '#ffd9a8',
    soft: 'rgba(255, 179, 92, 0.18)',
    grad: 'linear-gradient(135deg, #fcd34d 0%, #ffb35c 55%, #ff8a5c 100%)',
  },
  rose: {
    label: 'Rose',
    accent: '#ff6f9c',
    ink: '#ffb3c9',
    soft: 'rgba(255, 111, 156, 0.18)',
    grad: 'linear-gradient(135deg, #fda4af 0%, #ff6f9c 55%, #c084fc 100%)',
  },
};

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Settings live in localStorage and are shared by every screen through App. */
export function useSettings() {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage can be unavailable — settings still work for this session */
    }
  }, [settings]);

  const update = useCallback((patch) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), []);

  return { settings, update, reset };
}

/** Inline CSS variables for the chosen accent. */
export function accentVars(accent) {
  const palette = ACCENTS[accent] || ACCENTS.violet;
  return {
    '--accent': palette.accent,
    '--accent-ink': palette.ink,
    '--accent-soft': palette.soft,
    '--grad': palette.grad,
  };
}
