import { useEffect, useMemo, useRef } from 'react';

/**
 * Ambient layer: drifting aurora, twinkling stars, a pointer spotlight and —
 * when the app has been left alone — rising little Z's and a snore bubble.
 */
function useStars(count) {
  return useMemo(() => {
    const stars = [];
    let seed = 7;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < count; i += 1) {
      stars.push({
        left: `${(random() * 100).toFixed(2)}%`,
        top: `${(random() * 100).toFixed(2)}%`,
        size: `${(0.8 + random() * 1.9).toFixed(2)}px`,
        delay: `${(random() * 6).toFixed(2)}s`,
        duration: `${(2.6 + random() * 4).toFixed(2)}s`,
        opacity: (0.18 + random() * 0.5).toFixed(2),
      });
    }
    return stars;
  }, [count]);
}

function useDust(count) {
  return useMemo(() => {
    const motes = [];
    let seed = 31;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < count; i += 1) {
      motes.push({
        left: `${(random() * 100).toFixed(2)}%`,
        bottom: `${(random() * 45).toFixed(2)}%`,
        size: `${(1 + random() * 2.4).toFixed(2)}px`,
        delay: `${(random() * 14).toFixed(2)}s`,
        duration: `${(10 + random() * 11).toFixed(2)}s`,
        drift: `${(-40 + random() * 80).toFixed(0)}px`,
      });
    }
    return motes;
  }, [count]);
}

const METEORS = [
  { left: '70%', top: '-8%', delay: '1s', duration: '11s' },
  { left: '90%', top: '4%', delay: '6s', duration: '13s' },
  { left: '52%', top: '-14%', delay: '11s', duration: '15s' },
  { left: '98%', top: '20%', delay: '17s', duration: '14s' },
];

function SleepZs({ asleep }) {
  const zs = useMemo(
    () =>
      Array.from({ length: asleep ? 7 : 4 }, (_, index) => ({
        left: `${46 + index * 7}%`,
        delay: `${index * 1.1}s`,
        size: `${11 + (index % 3) * 5}px`,
        duration: `${4.2 + (index % 4) * 0.8}s`,
      })),
    [asleep]
  );

  return (
    <div className={`sleep-layer ${asleep ? 'asleep' : 'idle'}`} aria-hidden="true">
      {zs.map((z, index) => (
        <span
          key={index}
          className="zzz"
          style={{
            left: z.left,
            animationDelay: z.delay,
            fontSize: z.size,
            animationDuration: z.duration,
          }}
        >
          z
        </span>
      ))}
      {asleep && (
        <div className="snore-bubble">
          <span className="snore-face">😴</span>
          <span className="snore-text">
            snoring<span className="snore-dots" />
          </span>
        </div>
      )}
    </div>
  );
}

export default function Ambient({ level = 'awake' }) {
  const stars = useStars(34);
  const dust = useDust(18);
  const rootRef = useRef(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    let frame = 0;

    const onMove = (event) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = node.getBoundingClientRect();
        node.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        node.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={`ambient ${level}`} ref={rootRef} aria-hidden="true">
      <div className="nebula">
        <span className="nebula-blob nebula-1" />
        <span className="nebula-blob nebula-2" />
      </div>
      <div className="grid-veil" />
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="meteors">
        {METEORS.map((meteor, index) => (
          <span
            key={index}
            className="meteor"
            style={{
              left: meteor.left,
              top: meteor.top,
              animationDelay: meteor.delay,
              animationDuration: meteor.duration,
            }}
          />
        ))}
      </div>
      <div className="dust">
        {dust.map((mote, index) => (
          <span
            key={index}
            className="dust-mote"
            style={{
              left: mote.left,
              bottom: mote.bottom,
              width: mote.size,
              height: mote.size,
              animationDelay: mote.delay,
              animationDuration: mote.duration,
              '--drift': mote.drift,
            }}
          />
        ))}
      </div>
      <div className="stars">
        {stars.map((star, index) => (
          <span
            key={index}
            className="star"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
              animationDuration: star.duration,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>
      <div className="spotlight" />
      {level !== 'awake' && <SleepZs asleep={level === 'asleep'} />}
    </div>
  );
}
