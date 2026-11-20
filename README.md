# Orbit — coding agent

A chat IDE whose agent works on your code through tools: workspace edits, GitHub, Hugging Face,
VS Code and app-store checks. Every turn runs on **Gemma 4** (`@cf/google/gemma-4-26b-a4b-it`)
via Cloudflare Workers AI — it is the only model the app offers.

- **Model** — Gemma 4 calls the tool registry; there is no model picker beyond it and no other
  provider. Without Cloudflare credentials the chat reports what is missing.
- **Tools in one menu** — Fix workspace, Debug, Check a snippet, Workspace files, Store readiness,
  Search the web, GitHub, Hugging Face, Detect platform and VS Code files all live in the **Tools** menu.
- **Its own browser** — `web_search` queries the live web (Bing, then DuckDuckGo instant answers,
  then Wikipedia) and `web_fetch` opens a public page and returns its readable text. No API key,
  no user tab; private/local addresses are refused.
- **Its own computer** — an isolated E2B Linux desktop with Chromium. Gemma 4 launches Chrome,
  opens URLs, clicks coordinates, types, runs shell commands and captures screenshots to check
  its own work (`desktop_launch`, `desktop_navigate`, `desktop_click`, `desktop_type`,
  `desktop_key`, `desktop_terminal`, `desktop_screenshot`, `desktop_close`). Each screenshot is
  fed back to the model as an image and shown inline in the chat. Every sandbox is created with a
  3 minute lifetime, extended only by real tool use, killed on idle, on `desktop_close`, when the
  chat session is deleted or a new chat starts, and any leftover sandbox is reaped when the API
  restarts — so idle credits are never spent.
- **Full browser window** — on a wide viewport the app fills the screen and docks the session
  sidebar and workspace panel as real columns; in a narrow extension panel it falls back to the
  single-column drawer layout. Idle for a while and Orbit drifts off — little Z's, then a snoring
  bubble — until you type again.
- **Always-on scan** — every session open and every turn ends with an automatic scan of the
  workspace. Safe edits are applied by default (toggle **Auto** off to review first); anything
  ambiguous is listed as a suggested edit with file and line. The scan and the `autofix_workspace`
  tool are deterministic and local — they never call the model.
- **Workspace** — files live in a per-session workspace you can browse and export as a ZIP.
- **GitHub** — search repos, list directories and read files from any public repo with no token
  (60 requests/hour anonymously). A token only adds branch creation, commits and pull requests.
- **Hugging Face** — search models, datasets and spaces and read model cards with no token.
- **VS Code** — `generate_vscode_workspace` adds a `.code-workspace`, `.vscode/settings.json` and `tasks.json`; export the ZIP and open the folder.
- **Platform detection** — `GET /api/platform` reports the OS, container, runtime, shell, editor,
  CI, git repo and installed tools of the machine the agent runs on.
- **45 platforms** — the **Integrations** tab lists a catalog of 45 services (code hosting, deploy,
  package registries, backend & data, AI & ML, design, team & comms, monitoring, editor). Each row
  shows whether it is connected (its env var is present), readable without a token, or needs a
  token. `list_platforms` gives the agent the same list and `platform_request` reads a path from a
  platform's REST API (GET only, hosts limited to the catalog, credentials taken from the secrets).
- **Store readiness tests** — `test_store_readiness` runs local checks against Chrome Web Store,
  Microsoft Edge Add-ons, Mozilla Add-ons, Opera Add-ons, Google Play, Apple App Store, VS Code
  Marketplace and Hugging Face Spaces, and lists exactly what each one is missing (manifest fields,
  icons, target SDK, signing, privacy policy/manifest, listing screenshots). The **Stores** tab in
  the panel shows the same report.

## Run locally

```sh
cd server && npm install && npm start     # API on :8000
cd client && npm install && npm run dev   # UI on :5173, proxies /api
```

## Credentials

| Key | Required | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_KEY` | yes | Cloudflare API token with Workers AI access — the model |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Cloudflare account id used in the Workers AI endpoint |
| `GITHUB_TOKEN` | no | Only for commits and pull requests, `repo` scope |
| `HF_TOKEN` | no | Only for private Hugging Face repos and higher rate limits |
| `E2B_API_KEY` | no | Orbit's own Linux desktop (Chromium, terminal, screenshots). Without it the desktop tools report that the computer is not connected |

`GROQ_API_KEY` is not read anywhere. Public GitHub reads and Hugging Face search work without
their tokens.

## Endpoints

- `POST /api/sessions/:id/chat` — SSE turn: Gemma 4 runs the tools and streams the answer.
- `GET /api/models` — the single locked model.
- `GET /api/sessions/:id/scan` — scans the workspace and returns suggested edits without applying them.
- `POST /api/sessions/:id/autofix` — repairs the workspace and returns the findings as JSON.
- `POST /api/sessions/:id/store-tests` — runs the store readiness checks (`targets` optional) and
  returns the per-store report as JSON.
- `GET /api/stores` — the store catalog the tests cover.
- `GET /api/platforms` — the 45-platform catalog with live connection state.
- `GET /api/platform` — environment detection.

## Layout

```
server/   Express + SSE turn loop, Cloudflare client, tool registry, JSON/file session store
client/   Vite + React chat UI, tools menu, workspace panel, integrations panel
```
