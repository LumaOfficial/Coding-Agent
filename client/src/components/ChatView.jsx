import { useEffect, useRef } from 'react';
import Markdown from './Markdown.jsx';
import ToolCard from './ToolCard.jsx';
import Composer from './Composer.jsx';
import {
  IconAlert,
  IconGithub,
  IconMenu,
  IconPanel,
  IconSpark,
  IconTerminal,
} from './Icons.jsx';

const SUGGESTIONS = [
  {
    icon: <IconSpark width={14} height={14} />,
    title: 'Build a full app',
    prompt:
      'Build a Next.js dashboard for tracking freelance invoices with a sidebar, charts and a create-invoice form. Write every file to the workspace.',
  },
  {
    icon: <IconGithub width={14} height={14} />,
    title: 'Work on a GitHub repo',
    prompt:
      'List the files in the root of my GitHub repo and review the README, then suggest improvements.',
  },
  {
    icon: <IconSpark width={14} height={14} />,
    title: 'Pick a Hugging Face model',
    prompt:
      'Search Hugging Face for small instruction-tuned models that run on a laptop, compare the top 3 and recommend one.',
  },
  {
    icon: <IconTerminal width={14} height={14} />,
    title: 'Scaffold + VS Code',
    prompt:
      'Scaffold a FastAPI service with one /health route and a test, then add VS Code workspace files so I can open it locally.',
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
        Build with <span className="grad">Forge</span>
      </h1>
      <p className="empty-sub">
        A Groq-powered coding agent. It writes real files into a workspace, commits to GitHub,
        finds Hugging Face models, and packages everything for VS Code.
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
  onOpenPanel,
  onToggleSidebar,
  groqConfigured,
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
            {streaming ? 'working…' : activeModel ? activeModel.label : 'Groq'}
          </span>
        </div>
        <div className="chat-actions">
          <select
            className="model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            title="Groq model"
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

      {!groqConfigured && (
        <div className="banner">
          <IconAlert width={14} height={14} />
          <span>
            No Groq key yet — add <code>GROQ_API_KEY</code> and the agent comes online.
          </span>
          <button className="banner-link" onClick={() => onOpenPanel('integrations')}>
            Open integrations
          </button>
        </div>
      )}

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
          Files land in the workspace panel — export them as a ZIP to open in VS Code.
        </div>
      </div>
    </div>
  );
}
