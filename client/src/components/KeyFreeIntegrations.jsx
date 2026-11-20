import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconGithub,
  IconGlobe,
  IconSend,
  IconSpark,
} from './Icons.jsx';
import { downloadFile, isExtension } from '../api.js';

/**
 * Key-free integrations. Nothing here asks for an API key or a client ID: Orbit
 * borrows the session the user is already signed into in their browser, and
 * every send / create / play waits for an approval card in the chat.
 */

const ITEMS = [
  {
    key: 'email',
    title: 'Email',
    icon: <IconSend width={15} height={15} />,
    ready: 'Gmail · Outlook · Yahoo · mail app',
    description:
      'Orbit reads your inbox and writes a message with the recipient, subject and body already filled in. Pressing Send always waits for your approval.',
  },
  {
    key: 'github',
    title: 'GitHub',
    icon: <IconGithub width={15} height={15} />,
    ready: 'Create repos with your session',
    description:
      'Creates a repository from the new-repository page pre-filled with the name and description, then presses Create after you allow it. Public reads keep working without signing in.',
  },
  {
    key: 'music',
    title: 'Music',
    icon: <IconSpark width={15} height={15} />,
    ready: 'YouTube Music · Spotify · SoundCloud · Apple Music',
    description:
      'Starts a song, artist or playlist in the player you already pay for. Orbit only opens the page and presses play — no listening history leaves your account.',
  },
  {
    key: 'calendar',
    title: 'Calendar',
    icon: <IconGlobe width={15} height={15} />,
    ready: 'Google Calendar',
    description:
      'Opens a pre-filled event with the title, time, location and notes so you only press Save. Great for turning “remind me Thursday at 3” into a real event.',
  },
];

export default function KeyFreeIntegrations({ connected }) {
  return (
    <section className="keyfree">
      <div className="keyfree-head">
        <span className="integration-group-label">Everyday integrations</span>
        <span className={`keyfree-badge ${connected ? 'ok' : ''}`}>
          {connected ? 'Ready' : isExtension ? 'Not connected' : 'Needs the extension'}
        </span>
      </div>
      <p className="keyfree-note">
        No API keys, no client IDs. Orbit uses the accounts you are already signed into in your
        browser, and every send, create or play waits for your approval first.
      </p>

      {ITEMS.map((item) => (
        <div className={`integration ${connected ? 'connected' : ''}`} key={item.key}>
          <div className="integration-head">
            <span className="integration-icon">{item.icon}</span>
            <div className="integration-titles">
              <div className="integration-title">{item.title}</div>
              <div className="integration-status">
                {connected ? (
                  <IconCheck width={12} height={12} />
                ) : (
                  <IconAlert width={12} height={12} />
                )}
                {connected ? item.ready : 'Connect your browser to use it'}
              </div>
            </div>
          </div>
          <p className="integration-desc">{item.description}</p>
        </div>
      ))}

      {!connected &&
        (isExtension ? (
          <p className="keyfree-note">
            The extension is installed — open the Orbit toolbar icon and press Save &amp; connect
            so it can reach this API.
          </p>
        ) : (
          <button
            className="btn-small"
            onClick={() =>
              downloadFile('/api/browser/extension.zip', 'orbit-browser-extension.zip').catch(
                () => {}
              )
            }
          >
            <IconDownload width={13} height={13} />
            Get the extension
          </button>
        ))}
    </section>
  );
}
