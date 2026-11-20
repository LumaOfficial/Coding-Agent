# Forge — coding agent

A chat IDE whose agent works on your code through tools: workspace edits, GitHub, Hugging Face,
VS Code and app-store checks. Every turn runs on **Gemma 4** (`@cf/google/gemma-4-26b-a4b-instruct`)
via Cloudflare Workers AI — it is the only model the app offers.

- **Model** — Gemma 4 calls the tool registry; there is no model picker beyond it and no other
  provider. Without Cloudflare credentials the chat reports what is missing.
- **Tools in one menu** — Fix workspace, Debug, Check a snippet, Workspace files, Store readiness,
  GitHub, Hugging Face, Detect platform and VS Code files all live in the **Tools** menu.
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
- `GET /api/platform` — environment detection.

## Layout

```
server/   Express + SSE turn loop, Cloudflare client, tool registry, JSON/file session store
client/   Vite + React chat UI, tools menu, workspace panel, integrations panel
```
