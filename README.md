# Forge — local coding agent

A chat IDE whose agent repairs and debugs code for you, with no model calls and no API key.

- **Local engine** — deterministic repair and debugging: syntax errors, invalid JSON, missing
  imports, unbalanced braces, unclosed tags, line endings, whitespace, tabs, trailing commas,
  `debugger` statements and final newlines. Nothing leaves the machine.
- **Workspace** — files live in a per-session workspace you can browse and export as a ZIP.
- **GitHub** — search repos, list directories, read files, create branches, commit and open pull requests.
- **Hugging Face** — search models, datasets and spaces, and read model cards.
- **VS Code** — `generate_vscode_workspace` adds a `.code-workspace`, `.vscode/settings.json` and `tasks.json`; export the ZIP and open the folder.
- **Platform detection** — `GET /api/platform` reports the OS, container, runtime, shell, editor,
  CI, git repo and installed tools of the machine the agent runs on.

## Run locally

```sh
cd server && npm install && npm start     # API on :8000
cd client && npm install && npm run dev   # UI on :5173, proxies /api
```

## Credentials

No key is required. The engine is local; `GROQ_API_KEY` is not read anywhere.

| Key | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | for GitHub tools | Repo read/commit/PR, `repo` scope |
| `HF_TOKEN` | no | Private Hugging Face repos, higher rate limits |

The UI runs without them and shows what is not connected.

## Endpoints

- `POST /api/sessions/:id/chat` — SSE turn: runs the local engine and streams the report.
- `POST /api/sessions/:id/autofix` — repairs the workspace and returns the findings as JSON.
- `GET /api/platform` — environment detection.

## Layout

```
server/   Express + SSE turn loop, autofix engine, tool registry, JSON/file session store
client/   Vite + React chat UI, workspace panel, integrations panel
```
