import { useCallback, useEffect, useRef, useState } from 'react';
import { api, streamChat } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import ChatView from './components/ChatView.jsx';
import RightPanel from './components/RightPanel.jsx';
import Ambient from './components/Ambient.jsx';
import AuthScreen, { AuthBoot } from './components/AuthScreen.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import useIdle from './lib/useIdle.js';
import useBrowserLayout from './lib/useBrowserLayout.js';
import { accentVars, useSettings } from './lib/settings.js';

export default function App() {
  const full = useBrowserLayout();
  const { settings, update: updateSettings, reset: resetSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('cloudflare/gemma-4-26b-a4b-it');
  const [integrations, setIntegrations] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const idle = useIdle({ enabled: !streaming && settings.idleSleep });
  const [liveText, setLiveText] = useState('');
  const [liveTools, setLiveTools] = useState([]);
  const [error, setError] = useState('');
  const [browserRequest, setBrowserRequest] = useState(null);
  const [browserBusy, setBrowserBusy] = useState(false);
  const [consentRequest, setConsentRequest] = useState(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('files');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const abortRef = useRef(null);
  const activeIdRef = useRef(null);
  const autoFixRef = useRef(settings.autoFix);
  const scanTokenRef = useRef(0);

  useEffect(() => {
    autoFixRef.current = settings.autoFix;
  }, [settings.autoFix]);

  // Always-on scan: runs by itself on every session open and after every turn.
  const runScan = useCallback(async (id) => {
    if (!id) return;
    const token = ++scanTokenRef.current;
    setScanning(true);
    try {
      const result = await api.scan(id);
      if (token !== scanTokenRef.current) return;
      setScan(result);

      if (autoFixRef.current && result.fixes.length) {
        const applied = await api.autofix(id);
        if (token !== scanTokenRef.current) return;
        const filesData = await api.workspace(id).catch(() => null);
        if (filesData) setFiles(filesData.files);
        const after = await api.scan(id);
        if (token !== scanTokenRef.current) return;
        setScan({ ...after, applied: applied.fixes });
      }
    } catch {
      /* scan is best-effort — never block the chat */
    } finally {
      if (token === scanTokenRef.current) setScanning(false);
    }
  }, []);

  const openSession = useCallback(
    async (id) => {
      abortRef.current?.abort();
      setStreaming(false);
      setLiveText('');
      setLiveTools([]);
      setError('');
      setScan(null);
      try {
        const data = await api.session(id);
        activeIdRef.current = id;
        setSession(data.session);
        setMessages(data.messages);
        setFiles(data.files);
      } catch (err) {
        setError(err.message);
      }
      setSidebarOpen(false);
      runScan(id);
    },
    [runScan]
  );

  const refreshIntegrations = useCallback(async () => {
    try {
      setIntegrations(await api.integrations());
    } catch {
      /* ignore */
    }
  }, []);

  // Restore the signed-in account from the httpOnly session cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) setUser(me.user || null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [m, s, integ] = await Promise.all([api.models(), api.sessions(), api.integrations()]);
        if (cancelled) return;
        setModels(m.models);
        setModel(m.default);
        setIntegrations(integ);
        setSessions(s.sessions);
        // Always start on a fresh chat; past sessions stay in the sidebar.
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, openSession]);

  async function newSession() {
    abortRef.current?.abort();
    if (activeIdRef.current) api.closeDesktop(activeIdRef.current).catch(() => {});
    activeIdRef.current = null;
    setSession(null);
    setMessages([]);
    setFiles([]);
    setLiveText('');
    setLiveTools([]);
    setError('');
    setScan(null);
    setSidebarOpen(false);
  }

  async function removeSession(id, event) {
    event.stopPropagation();
    await api.deleteSession(id);
    const rest = sessions.filter((s) => s.id !== id);
    setSessions(rest);
    if (session?.id === id) {
      if (rest.length) await openSession(rest[0].id);
      else await newSession();
    }
  }

  async function approveBrowser(approved) {
    if (!browserRequest) return;
    const id = browserRequest.id;
    setBrowserBusy(true);
    setBrowserRequest(null);
    try {
      await api.approveBrowser(id, approved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBrowserBusy(false);
    }
  }

  async function approveConsent(approved) {
    if (!consentRequest) return;
    const id = consentRequest.id;
    setConsentBusy(true);
    setConsentRequest(null);
    try {
      await api.approveConsent(id, approved);
    } catch (err) {
      setError(err.message);
    } finally {
      setConsentBusy(false);
    }
  }

  async function changeModel(next) {
    setModel(next);
    if (session) {
      setSession({ ...session, model: next });
      try {
        await api.session(session.id);
      } catch {
        /* ignore */
      }
    }
  }

  async function send(text) {
    if (streaming || !text.trim()) return;
    setError('');

    let active = session;
    if (!active) {
      try {
        const { session: created } = await api.createSession({ model });
        active = created;
        setSession(created);
        setSessions((prev) => [created, ...prev]);
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    const sid = active.id;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content: text },
    ]);
    setStreaming(true);
    setLiveText('');
    setLiveTools([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        sessionId: sid,
        message: text,
        model,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'text') {
            setLiveText((prev) => prev + event.delta);
          } else if (event.type === 'tool_start') {
            setLiveTools((prev) => [
              ...prev,
              { id: event.id, name: event.name, args: event.args, status: 'running' },
            ]);
          } else if (event.type === 'tool_result') {
            setLiveTools((prev) =>
              prev.map((tool) =>
                tool.id === event.id
                  ? { ...tool, status: event.ok ? 'ok' : 'error', result: event.result }
                  : tool
              )
            );
          } else if (event.type === 'browser_request') {
            setBrowserRequest(event);
          } else if (event.type === 'consent_request') {
            setConsentRequest(event);
          } else if (event.type === 'error') {
            setError(event.message);
          }
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setStreaming(false);
      setBrowserRequest(null);
      setConsentRequest(null);
      abortRef.current = null;
      try {
        const data = await api.session(sid);
        setSession(data.session);
        setMessages(data.messages);
        setFiles(data.files);
        setSessions((prev) => [data.session, ...prev.filter((s) => s.id !== sid)]);
      } catch {
        /* keep optimistic state */
      }
      setLiveText('');
      setLiveTools([]);
      runScan(sid);
    }
  }

  async function applyFixes() {
    if (!session || scanning) return;
    const id = session.id;
    setScanning(true);
    try {
      const applied = await api.autofix(id);
      const after = await api.scan(id);
      setScan({ ...after, applied: applied.fixes });
      const data = await api.workspace(id);
      setFiles(data.files);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function refreshFiles() {
    if (!session) return;
    try {
      const data = await api.workspace(session.id);
      setFiles(data.files);
    } catch {
      /* ignore */
    }
  }

  async function signOut() {
    abortRef.current?.abort();
    try {
      await api.logout();
    } catch {
      /* sign out locally even if the request fails */
    }
    activeIdRef.current = null;
    setUser(null);
    setSessions([]);
    setSession(null);
    setMessages([]);
    setFiles([]);
    setIntegrations(null);
    setError('');
    setSidebarOpen(false);
    setPanelOpen(false);
  }

  if (booting) return <AuthBoot />;
  if (!user) return <AuthScreen onAuthed={setUser} />;

  return (
    <div
      className={`app ${full ? 'full' : ''} ${idle !== 'awake' ? idle : ''} ${
        settings.density === 'compact' ? 'compact' : ''
      } ${settings.motion ? '' : 'no-motion'} ${settings.wrapCode ? 'wrap-code' : ''}`}
      style={accentVars(settings.accent)}
    >
      <Ambient level={idle} effects={settings.ambient} spotlight={settings.spotlight} />
      <Sidebar
        sessions={sessions}
        activeId={session?.id}
        onSelect={openSession}
        onNew={newSession}
        onDelete={removeSession}
        integrations={integrations}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        idle={idle}
        user={user}
        onSignOut={signOut}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="main">
        <ChatView
          session={session}
          messages={messages}
          models={models}
          model={model}
          onModelChange={changeModel}
          onSend={send}
          onStop={stop}
          streaming={streaming}
          liveText={liveText}
          liveTools={liveTools}
          error={error}
          browserRequest={browserRequest}
          browserBusy={browserBusy}
          onBrowserApprove={approveBrowser}
          consentRequest={consentRequest}
          consentBusy={consentBusy}
          onConsentApprove={approveConsent}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          scan={scan}
          scanning={scanning}
          autoFix={settings.autoFix}
          onToggleAutoFix={() => updateSettings({ autoFix: !settings.autoFix })}
          settings={settings}
          onOpenSettings={() => setSettingsOpen(true)}
          onApplyFixes={applyFixes}
          onOpenStoreTests={() => {
            setPanelTab('stores');
            setPanelOpen(true);
          }}
          onOpenPanel={(tab) => {
            setPanelTab(tab);
            setPanelOpen(true);
          }}
          idle={idle}
        />
      </main>

      {panelOpen && (
        <RightPanel
          session={session}
          files={files}
          integrations={integrations}
          onRefreshFiles={refreshFiles}
          onRefreshIntegrations={refreshIntegrations}
          tab={panelTab}
          setTab={setPanelTab}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onReset={resetSettings}
        onClose={() => setSettingsOpen(false)}
        user={user}
      />
    </div>
  );
}
