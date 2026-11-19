import { useEffect, useRef } from 'react';
import Markdown from './Markdown.jsx';
import ToolCard from './ToolCard.jsx';
import Composer from './Composer.jsx';
import {
  IconAlert,
  IconFile,
  IconGithub,
  IconMenu,
  IconPanel,
  IconSpark,
  IconTerminal,
} from './Icons.jsx';

const SUGGESTIONS = [
  {
    icon: <IconSpark width={14} height={14} />,
    title: 'Fix my workspace',
    prompt: 'Fix the code in my workspace and debug it.',
  },
  {
    icon: <IconAlert width={14} height={14} />,
    title: 'Debug everything',
    prompt: 'Debug my workspace and show every syntax error and missing import with file and line.',
  },
  {
    icon: <IconTerminal width={14} height={14} />,
    title: 'Check a snippet',
    prompt:
      'Check this snippet and fix it:\n\n```js\nfunction add(a, b) {\n  return a + b\n}\n\nconst total = add(1, 2;\n```',
  },
  {
    icon: <IconGithub width={14} height={14} />,
    title: 'Detect my platform',
    prompt: 'What coding platform am I on?',
  },
  {
    icon: <IconFile width={14} height={14} />,
    title: 'Test store readiness',
    prompt:
      'Run store readiness tests on my workspace for the Chrome Web Store, Google Play, the Apple App Store and Firefox Add-ons, and show what is missing.',
  },
];

function buildTimeline(messages) {
  const results = new Map();
  for (const m of messages) {
    if (m.role === 'tool') results.set(m.tool_call_id, m);
  }
  const timeline = [];
  for (const m of messages) {
    if (m.role === 'tool') continue;
    if (m.role === 'assistant') {
      const cards = (m.tool_calls || []).map((call) => {
        const toolResult = results.get(call.id);
        return {
          id: call.id,
          name: call.name,
          args: safeArgs(call.arguments),
          result: toolResult?.content,
          status: toolResult ? (toolResult.content.startsWith('Error:') ? 'error' : 'ok') : 'running',
        };
      });
      if (!m.content && cards.length === 0) continue;
      timeline.push({ ...m, cards });
    } else {
      timeline.push(m);
    }
  }
  return timeline;
}

function safeArgs(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function Turn({ role, content, cards = [], streaming = false }) {
  if (role === 'user') {
    return (
      <div className="turn turn-user">
        <div className="turn-tag">You</div>
        <div className="turn-user-body">{content}</div>
      </div>
    );
  }
  return (
    <div className="turn turn-assistant">
      <div className="turn-head">
        <span className="avatar">
          <IconSpark width={13} height={13} />
        </span>
        <span className="turn-tag">Forge</span>
      </div>
      <div className="turn-body">
        {content ? <Markdown>{content}</Markdown> : null}
        {cards.map((card) => (
          <ToolCard
            key={card.id}
            name={card.name}
            args={card.args}
            result={card.result}
            status={card.status}
          />
        ))}
        {streaming && <span className="cursor" />}
        {streaming && !content && cards.length === 0 && (
          <div className="thinking">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <IconSpark width={22} height={22} />
      </div>
      <h1 className="empty-title">
        Fix with <span className="grad">Forge</span>
      </h1>
      <p className="empty-sub">
        A local coding agent that repairs and debugs your files, then tests them against app
        stores — with no API key and no model calls.
      </p>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s.title} className="suggestion" onClick={() => onPick(s.prompt)}>
            <span className="suggestion-icon">{s.icon}</span>
            <span className="suggestion-title">{s.title}</span>
            <span className="suggestion-prompt">{s.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatView({
  session,
  messages,
  models,
  model,
  onModelChange,
  onSend,
  onStop,
  streaming,
  liveText,
  liveTools,
  error,
  panelOpen,
  onTogglePanel,
  onToggleSidebar,
  onOpenStoreTests,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, liveText, liveTools, streaming]);

  const timeline = buildTimeline(messages);
  const activeModel = models.find((m) => m.id === model);

  return (
    <div className="chat">
      <header className="chat-header">
        <button className="icon-btn only-mobile" onClick={onToggleSidebar} title="Sessions">
          <IconMenu />
        </button>
        <div className="chat-title">
          <span className="chat-title-text">{session?.title || 'New session'}</span>
          <span className="chat-sub">
            {streaming ? 'working…' : activeModel ? activeModel.label : 'Local'}
          </span>
        </div>
        <div className="chat-actions">
          <button
            className="fix-btn"
            onClick={() => onSend('Fix the code in my workspace and debug it.')}
            disabled={streaming}
            title="Run the local auto-fixer"
          >
            <IconTerminal width={13} height={13} />
            Fix code
          </button>
          <button
            className="fix-btn ghost"
            onClick={onOpenStoreTests}
            title="Test the workspace against app stores"
          >
            <IconFile width={13} height={13} />
            Store tests
          </button>
          <select
            className="model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            title="Engine"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            className={`icon-btn ${panelOpen ? 'active' : ''}`}
            onClick={onTogglePanel}
            title="Toggle workspace panel"
          >
            <IconPanel />
          </button>
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {timeline.length === 0 && !streaming ? (
            <EmptyState onPick={onSend} />
          ) : (
            timeline.map((item) => (
              <Turn
                key={item.id}
                role={item.role}
                content={item.content}
                cards={item.cards}
              />
            ))
          )}

          {streaming && (
            <Turn role="assistant" content={liveText} cards={liveTools} streaming />
          )}

          {error && (
            <div className="error-box">
              <IconAlert width={15} height={15} />
              <div>
                <div className="error-title">The agent hit a problem</div>
                <div className="error-text">{error}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="composer-wrap">
        <Composer onSend={onSend} streaming={streaming} onStop={onStop} />
        <div className="composer-hint">
          Files land in the workspace — export a ZIP for VS Code.
        </div>
      </div>
    </div>
  );
}
