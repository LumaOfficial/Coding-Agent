import { useEffect, useRef } from 'react';
import Markdown from './Markdown.jsx';
import ToolCard from './ToolCard.jsx';
import Composer from './Composer.jsx';
import ScanCard from './ScanCard.jsx';
import BrowserCard from './BrowserCard.jsx';
import ToolsMenu from './ToolsMenu.jsx';
import { COSMIC_THOUGHTS, toolActivity, useRotatingMessage } from '../lib/status.js';
import { IconAlert, IconMenu, IconMoon, IconPanel, IconSpark } from './Icons.jsx';

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

function Turn({ role, content, cards = [], streaming = false, index = 0, streamingLabel = 'Thinking…' }) {
  if (role === 'user') {
    return (
      <div className="turn turn-user" style={{ '--turn-index': index }}>
        <div className="turn-tag">You</div>
        <div className="turn-user-body">{content}</div>
      </div>
    );
  }
  return (
    <div className="turn turn-assistant" style={{ '--turn-index': index }}>
      <div className="turn-head">
        <span className="avatar">
          <IconSpark width={13} height={13} />
        </span>
        <span className="turn-tag">Orbit</span>
      </div>
      <div className="turn-body">
        {content ? <Markdown>{content}</Markdown> : null}
        {streaming && !content && cards.length > 0 && (
          <div className="thinking-row">
            <span className="thinking-label">{streamingLabel}</span>
          </div>
        )}
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
          <div className="thinking-row">
            <span className="thinking-label">{streamingLabel}</span>
            <div className="thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onSend, onOpenPanel, onOpenStoreTests, idle = 'awake' }) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <IconSpark width={24} height={24} />
      </div>
      <span className="empty-eyebrow">Cloudflare Workers AI · Gemma 4</span>
      <h1 className="empty-title">
        Build with <span className="grad">Orbit</span>
      </h1>
      <p className="empty-sub">
        One agent for your workspace, GitHub, Hugging Face and app-store checks. Every tool is
        in one menu — or just describe what you need.
      </p>
      <div className="empty-tools">
        <ToolsMenu
          inline
          onSend={onSend}
          onOpenPanel={onOpenPanel}
          onOpenStoreTests={onOpenStoreTests}
        />
      </div>
      <div className="empty-chips">
        <span className="chip">Auto-fix</span>
        <span className="chip">Debug</span>
        <span className="chip">Web search</span>
        <span className="chip">Desktop</span>
        <span className="chip">GitHub</span>
        <span className="chip">Hugging Face</span>
        <span className="chip">Store tests</span>
      </div>
      {idle !== 'awake' && (
        <div className="idle-note">
          <IconMoon width={13} height={13} />
          Orbit is {idle === 'asleep' ? 'snoring' : 'resting'} — type to wake it up.
        </div>
      )}
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
  browserRequest,
  browserBusy,
  onBrowserApprove,
  panelOpen,
  onTogglePanel,
  onToggleSidebar,
  onOpenStoreTests,
  onOpenPanel,
  scan,
  scanning,
  autoFix,
  onToggleAutoFix,
  onApplyFixes,
  idle = 'awake',
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, liveText, liveTools, streaming]);

  const timeline = buildTimeline(messages);
  const activeModel = models.find((m) => m.id === model);
  const runningTool = liveTools.find((tool) => tool.status === 'running');
  const thought = useRotatingMessage(
    COSMIC_THOUGHTS,
    2400,
    streaming && !liveText && !runningTool
  );
  const liveStatus = runningTool ? toolActivity(runningTool.name, runningTool.args) : thought;
  const phase = streaming
    ? runningTool
      ? 'tools'
      : liveText
        ? 'writing'
        : 'thinking'
    : idle !== 'awake'
      ? 'resting'
      : 'ready';
  const statusLabel = {
    ready: activeModel ? activeModel.label : 'Gemma 4 26B',
    thinking: thought,
    writing: 'Writing…',
    tools: liveStatus,
    resting: idle === 'asleep' ? 'Snoring… zzz' : 'Resting… zzz',
  }[phase];

  return (
    <div className="chat">
      <header className="chat-header">
        <div className="header-top">
          <button className="icon-btn" onClick={onToggleSidebar} title="Sessions">
            <IconMenu />
          </button>
          <div className="chat-title">
            <span className="chat-title-text">{session?.title || 'New session'}</span>
            <span className="chat-sub">
              <span className={`live-dot ${streaming ? 'busy' : ''}`} />
              <span className={`status-label ${phase}`}>{statusLabel}</span>
            </span>
          </div>
          <button
            className={`icon-btn ${panelOpen ? 'active' : ''}`}
            onClick={onTogglePanel}
            title="Toggle workspace panel"
          >
            <IconPanel />
          </button>
        </div>

        <div className="toolbar">
          <ToolsMenu
            onSend={onSend}
            onOpenPanel={onOpenPanel}
            onOpenStoreTests={onOpenStoreTests}
            disabled={streaming}
          />
          <select
            className="model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            title="Model — locked"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {timeline.length === 0 && !streaming ? (
            <EmptyState
              onSend={onSend}
              onOpenPanel={onOpenPanel}
              onOpenStoreTests={onOpenStoreTests}
              idle={idle}
            />
          ) : (
            timeline.map((item, index) => (
              <Turn
                key={item.id}
                role={item.role}
                content={item.content}
                cards={item.cards}
                index={index}
              />
            ))
          )}

          {streaming && (
            <Turn
              role="assistant"
              content={liveText}
              cards={liveTools}
              streaming
              streamingLabel={liveStatus}
            />
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
        {browserRequest && (
          <BrowserCard
            request={browserRequest}
            busy={browserBusy}
            onApprove={onBrowserApprove}
          />
        )}
        {session && (
          <ScanCard
            scan={scan}
            scanning={scanning}
            autoFix={autoFix}
            onToggleAuto={onToggleAutoFix}
            onApply={onApplyFixes}
          />
        )}
        <Composer
          onSend={onSend}
          streaming={streaming}
          onStop={onStop}
          napping={idle !== 'awake' && !streaming}
        />
        <div className="composer-hint">
          Files land in the workspace — export a ZIP for VS Code.
        </div>
      </div>
    </div>
  );
}
