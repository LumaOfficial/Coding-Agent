# Forge — Groq coding agent

A chat IDE where an LLM agent writes real code for you and acts on the tools you use.

- **Groq** — every reply and tool call runs on a Groq-hosted model (`llama-3.3-70b-versatile` by default).
- **Workspace** — the agent writes files into a per-session workspace you can browse and export as a ZIP.
- **GitHub** — search repos, list directories, read files, create branches, commit and open pull requests.
- **Hugging Face** — search models, datasets and spaces, and read model cards.
- **VS Code** — `generate_vscode_workspace` adds a `.code-workspace`, `.vscode/settings.json` and `tasks.json`; export the ZIP and open the folder.

## Run locally

```sh
cd server && npm install && npm start     # API on :8000
cd client && npm install && npm run dev   # UI on :5173, proxies /api
```

## Credentials

Set these in the app's secrets (delivered as env vars):

| Key | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | Model inference for the agent |
| `GITHUB_TOKEN` | for GitHub tools | Repo read/commit/PR, `repo` scope |
| `HF_TOKEN` | no | Private Hugging Face repos, higher rate limits |

The UI runs without them and shows what is not connected.

## Layout

```
server/   Express + SSE agent loop, tool registry, JSON/file session store
client/   Vite + React chat UI, workspace panel, integrations panel
```
