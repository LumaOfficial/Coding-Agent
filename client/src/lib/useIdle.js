import { useEffect, useRef, useState } from 'react';

/**
 * Tracks user activity so the UI can fall asleep when nobody is around.
 * Returns 'awake', 'idle' (little Z's) or 'asleep' (snoring bubble).
 */
export default function useIdle({ enabled = true, idleAfter = 16_000, sleepAfter = 45_000 } = {}) {
  const [level, setLevel] = useState('awake');
  const lastRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) {
      setLevel('awake');
      return undefined;
    }

    lastRef.current = Date.now();
    let frame = 0;

    const wake = () => {
      lastRef.current = Date.now();
      setLevel((current) => (current === 'awake' ? current : 'awake'));
    };

    const onPointerMove = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        wake();
      });
    };

    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'];
    for (const event of events) window.addEventListener(event, wake, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const tick = window.setInterval(() => {
      const idleFor = Date.now() - lastRef.current;
      const next = idleFor > sleepAfter ? 'asleep' : idleFor > idleAfter ? 'idle' : 'awake';
      setLevel((current) => (current === next ? current : next));
    }, 1000);

    return () => {
      for (const event of events) window.removeEventListener(event, wake);
      window.removeEventListener('pointermove', onPointerMove);
      window.clearInterval(tick);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled, idleAfter, sleepAfter]);

  return level;
}
