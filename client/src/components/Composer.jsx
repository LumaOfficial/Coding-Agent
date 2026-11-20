import { useEffect, useRef, useState } from 'react';
import { IconSend, IconStop } from './Icons.jsx';

export default function Composer({ onSend, streaming, onStop, napping = false }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue('');
  }

  return (
    <div className={`composer ${napping ? 'napping' : ''}`}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        placeholder={
          napping
            ? 'Forge is napping… type to wake it up'
            : 'Paste code or ask Forge to fix your workspace…'
        }
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="composer-row">
        <span className="composer-tip">Shift + Enter for a new line</span>
        {streaming ? (
          <button className="send-btn stop" onClick={onStop}>
            <IconStop width={13} height={13} />
            Stop
          </button>
        ) : (
          <button className="send-btn" onClick={submit} disabled={!value.trim()}>
            <IconSend width={14} height={14} />
            Send
          </button>
        )}
      </div>
    </div>
  );
}
