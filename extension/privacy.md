# Orbit privacy policy

Orbit is a coding agent that runs on the API you point it at — by default
`http://localhost:8000` on your own machine.

## What the extension handles

- **Your API address.** Stored in `chrome.storage.local` so the app page and the
  background worker talk to the same Orbit server.
- **Your Orbit session token.** Issued by the Orbit server when you sign in and
  kept in the extension page's local storage, so you stay signed in.
- **The tab you allow.** When you ask Orbit to act in your browser, the
  background worker reads the page, and — only after you press **Allow** in the
  chat — clicks, types, scrolls or navigates and returns a screenshot.

## What it does not do

- No analytics, telemetry or advertising.
- No data is sent anywhere except the Orbit API address you configure.
- No browsing history, page content or screenshots are collected, stored or
  sold by the extension.

## Permissions

- `scripting` + `<all_urls>` — inject Orbit's cursor and run an approved click,
  type or scroll in the tab you choose.
- `tabs` — list and screenshot the tabs you ask Orbit to work with.
- `storage` — remember the API address and connection status.
- `activeTab` + `sidePanel` — open the app in the side panel or a tab.

Every action that changes a page waits for your approval in the chat. Declining
tells the agent to stop and ask what you want instead.

## Contact

Open an issue on the project's repository for privacy questions.
