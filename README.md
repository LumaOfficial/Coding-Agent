# Forge — local coding agent

A chat IDE whose agent repairs and debugs code for you, with no model calls and no API key.

- **Local engine** — deterministic repair and debugging: syntax errors, invalid JSON, missing
  imports, unbalanced braces, unclosed tags, line endings, whitespace, tabs, trailing commas,
  `debugger` statements and final newlines. Nothing leaves the machine.
- **Workspace** — files live in a per-session workspace you can browse and export as a ZIP.
- **GitHub** — search repos, list directories and read files from any public repo with no token
  (60 requests/hour anonymously). A token only adds branch creation, commits and pull requests.
- **Hugging Face** — search models, datasets and spaces and read model cards with no token.
- **VS Code** — `generate_vscode_workspace` adds a `.code-workspace`, `.vscode/settings.json` and `tasks.json`; export the ZIP and open the folder.
- **Platform detection** — `GET /api/platform` reports the OS, container, runtime, shell, editor,
  CI, git repo and installed tools of the machine the agent runs on.
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

No key is required. The engine is local; `GROQ_API_KEY` is not read anywhere.

| Key | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | no | Only for commits and pull requests, `repo` scope |
| `HF_TOKEN` | no | Only for private Hugging Face repos and higher rate limits |

Public GitHub reads and Hugging Face search work with neither key; the UI reports that state.

## Endpoints

- `POST /api/sessions/:id/chat` — SSE turn: runs the local engine and streams the report.
- `POST /api/sessions/:id/autofix` — repairs the workspace and returns the findings as JSON.
- `POST /api/sessions/:id/store-tests` — runs the store readiness checks (`targets` optional) and
  returns the per-store report as JSON.
- `GET /api/stores` — the store catalog the tests cover.
- `GET /api/platform` — environment detection.

## Layout

```
server/   Express + SSE turn loop, autofix engine, tool registry, JSON/file session store
client/   Vite + React chat UI, workspace panel, integrations panel
```
