/**
 * Platform catalog — the services Orbit can be pointed at.
 *
 * Each entry declares the env var(s) that connect it, whether its API is
 * readable without credentials, and (where the API has a stable base URL) how
 * to authenticate a read-only request. Nothing here is a credential: the
 * platform is "connected" only when the env var actually exists at runtime.
 */

export const CATEGORIES = [
  'Code hosting',
  'Deploy',
  'Package registries',
  'Backend & data',
  'AI & ML',
  'Design',
  'Team & comms',
  'Monitoring',
  'Editor',
];

const bearer = (env) => ({ env, header: 'Authorization', prefix: 'Bearer ' });

export const PLATFORMS = [
  // ---------------- code hosting ----------------
  {
    id: 'github',
    name: 'GitHub',
    category: 'Code hosting',
    env: ['GITHUB_TOKEN'],
    publicRead: true,
    api: 'https://api.github.com',
    auth: bearer('GITHUB_TOKEN'),
    docs: 'https://docs.github.com/rest',
    blurb: 'Search repos, read files, commit and open pull requests.',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'Code hosting',
    env: ['GITLAB_TOKEN'],
    api: 'https://gitlab.com/api/v4',
    auth: { env: 'GITLAB_TOKEN', header: 'PRIVATE-TOKEN', prefix: '' },
    docs: 'https://docs.gitlab.com/ee/api/rest/',
    blurb: 'Projects, merge requests and pipeline status.',
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    category: 'Code hosting',
    env: ['BITBUCKET_TOKEN'],
    api: 'https://api.bitbucket.org/2.0',
    auth: bearer('BITBUCKET_TOKEN'),
    docs: 'https://developer.atlassian.com/cloud/bitbucket/rest/',
    blurb: 'Repositories, pull requests and pipelines.',
  },
  {
    id: 'gitea',
    name: 'Gitea',
    category: 'Code hosting',
    env: ['GITEA_TOKEN'],
    docs: 'https://docs.gitea.com/api/',
    blurb: 'Self-hosted Git — point it at your own instance URL.',
  },
  {
    id: 'codeberg',
    name: 'Codeberg',
    category: 'Code hosting',
    env: ['CODEBERG_TOKEN'],
    api: 'https://codeberg.org/api/v1',
    auth: { env: 'CODEBERG_TOKEN', header: 'Authorization', prefix: 'token ' },
    docs: 'https://codeberg.org/api/swagger',
    blurb: 'Forgejo-based repos, issues and releases.',
  },

  // ---------------- deploy ----------------
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'Deploy',
    env: ['CLOUDFLARE_API_KEY'],
    api: 'https://api.cloudflare.com/client/v4',
    auth: bearer('CLOUDFLARE_API_KEY'),
    docs: 'https://developers.cloudflare.com/api/',
    blurb: 'Workers, Pages, R2 and the AI models this app runs on.',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Deploy',
    env: ['VERCEL_TOKEN'],
    api: 'https://api.vercel.com',
    auth: bearer('VERCEL_TOKEN'),
    docs: 'https://vercel.com/docs/rest-api',
    blurb: 'Projects, deployments and environment variables.',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    category: 'Deploy',
    env: ['NETLIFY_AUTH_TOKEN'],
    api: 'https://api.netlify.com/api/v1',
    auth: bearer('NETLIFY_AUTH_TOKEN'),
    docs: 'https://docs.netlify.com/api/get-started/',
    blurb: 'Sites, deploys and build hooks.',
  },
  {
    id: 'railway',
    name: 'Railway',
    category: 'Deploy',
    env: ['RAILWAY_TOKEN'],
    docs: 'https://docs.railway.com/reference/public-api',
    blurb: 'Services, volumes and deployments over GraphQL.',
  },
  {
    id: 'render',
    name: 'Render',
    category: 'Deploy',
    env: ['RENDER_API_KEY'],
    api: 'https://api.render.com/v1',
    auth: bearer('RENDER_API_KEY'),
    docs: 'https://api-docs.render.com/',
    blurb: 'Web services, cron jobs and deploys.',
  },
  {
    id: 'flyio',
    name: 'Fly.io',
    category: 'Deploy',
    env: ['FLY_API_TOKEN'],
    api: 'https://api.machines.dev/v1',
    auth: bearer('FLY_API_TOKEN'),
    docs: 'https://fly.io/docs/machines/api/',
    blurb: 'Machines, volumes and app status.',
  },
  {
    id: 'heroku',
    name: 'Heroku',
    category: 'Deploy',
    env: ['HEROKU_API_KEY'],
    docs: 'https://devcenter.heroku.com/articles/platform-api-reference',
    blurb: 'Dynos, releases and config vars.',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    category: 'Deploy',
    env: ['DIGITALOCEAN_TOKEN'],
    api: 'https://api.digitalocean.com/v2',
    auth: bearer('DIGITALOCEAN_TOKEN'),
    docs: 'https://docs.digitalocean.com/reference/api/',
    blurb: 'Droplets, App Platform and Spaces.',
  },
  {
    id: 'aws',
    name: 'AWS',
    category: 'Deploy',
    env: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    docs: 'https://docs.aws.amazon.com/',
    blurb: 'S3, Lambda and everything else under one IAM key.',
  },
  {
    id: 'gcp',
    name: 'Google Cloud',
    category: 'Deploy',
    env: ['GOOGLE_APPLICATION_CREDENTIALS'],
    docs: 'https://cloud.google.com/apis/docs/overview',
    blurb: 'Cloud Run, GCS and Pub/Sub via a service account.',
  },
  {
    id: 'azure',
    name: 'Azure',
    category: 'Deploy',
    env: ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'],
    docs: 'https://learn.microsoft.com/rest/api/azure/',
    blurb: 'App Service, Blob Storage and Entra apps.',
  },

  {
    id: 'koyeb',
    name: 'Koyeb',
    category: 'Deploy',
    env: ['KOYEB_TOKEN'],
    docs: 'https://www.koyeb.com/docs/api',
    blurb: 'Serverless services, volumes and regions.',
  },
  {
    id: 'denodeploy',
    name: 'Deno Deploy',
    category: 'Deploy',
    env: ['DENO_DEPLOY_TOKEN'],
    docs: 'https://docs.deno.com/deploy/api/',
    blurb: 'Edge functions and KV in the Deno runtime.',
  },

  // ---------------- package registries ----------------
  {
    id: 'npm',
    name: 'npm',
    category: 'Package registries',
    env: ['NPM_TOKEN'],
    publicRead: true,
    api: 'https://registry.npmjs.org',
    auth: bearer('NPM_TOKEN'),
    docs: 'https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md',
    blurb: 'Package metadata, versions and downloads.',
  },
  {
    id: 'pypi',
    name: 'PyPI',
    category: 'Package registries',
    env: ['PYPI_TOKEN'],
    publicRead: true,
    api: 'https://pypi.org/pypi',
    docs: 'https://docs.pypi.org/api/',
    blurb: 'Python package metadata and release history.',
  },
  {
    id: 'dockerhub',
    name: 'Docker Hub',
    category: 'Package registries',
    env: ['DOCKERHUB_TOKEN'],
    publicRead: true,
    api: 'https://hub.docker.com/v2',
    auth: bearer('DOCKERHUB_TOKEN'),
    docs: 'https://docs.docker.com/docker-hub/api/latest/',
    blurb: 'Repositories, tags and pull counts.',
  },
  {
    id: 'crates',
    name: 'crates.io',
    category: 'Package registries',
    env: ['CARGO_REGISTRY_TOKEN'],
    publicRead: true,
    api: 'https://crates.io/api/v1',
    docs: 'https://crates.io/data-access',
    blurb: 'Rust crate versions and dependencies.',
  },
  {
    id: 'rubygems',
    name: 'RubyGems',
    category: 'Package registries',
    env: ['RUBYGEMS_API_KEY'],
    publicRead: true,
    api: 'https://rubygems.org/api/v1',
    docs: 'https://guides.rubygems.org/rubygems-org-api/',
    blurb: 'Gem metadata and owners.',
  },
  {
    id: 'maven',
    name: 'Maven Central',
    category: 'Package registries',
    env: ['MAVEN_TOKEN'],
    docs: 'https://central.sonatype.org/search/rest-api/',
    blurb: 'Java artifact coordinates, versions and poms.',
  },
  {
    id: 'nuget',
    name: 'NuGet',
    category: 'Package registries',
    env: ['NUGET_API_KEY'],
    docs: 'https://learn.microsoft.com/nuget/api/overview',
    blurb: '.NET package versions and dependency graphs.',
  },
  {
    id: 'packagist',
    name: 'Packagist',
    category: 'Package registries',
    env: ['PACKAGIST_TOKEN'],
    docs: 'https://packagist.org/apidoc',
    blurb: 'PHP packages, versions and download counts.',
  },
  {
    id: 'pubdev',
    name: 'pub.dev',
    category: 'Package registries',
    env: ['PUB_TOKEN'],
    docs: 'https://pub.dev/help/api',
    blurb: 'Dart and Flutter packages, scores and versions.',
  },
  {
    id: 'hex',
    name: 'Hex',
    category: 'Package registries',
    env: ['HEX_API_KEY'],
    docs: 'https://hex.pm/docs/api',
    blurb: 'Elixir packages, releases and docs.',
  },

  // ---------------- backend & data ----------------
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'Backend & data',
    env: ['SUPABASE_ACCESS_TOKEN'],
    docs: 'https://supabase.com/docs/reference/api',
    blurb: 'Postgres, auth, storage and edge functions.',
  },
  {
    id: 'firebase',
    name: 'Firebase',
    category: 'Backend & data',
    env: ['FIREBASE_TOKEN'],
    docs: 'https://firebase.google.com/docs/reference/rest',
    blurb: 'Firestore, Auth, Hosting and remote config.',
  },
  {
    id: 'neon',
    name: 'Neon',
    category: 'Backend & data',
    env: ['NEON_API_KEY'],
    docs: 'https://api-docs.neon.tech/',
    blurb: 'Serverless Postgres branches and connection strings.',
  },
  {
    id: 'planetscale',
    name: 'PlanetScale',
    category: 'Backend & data',
    env: ['PLANETSCALE_SERVICE_TOKEN'],
    docs: 'https://planetscale.com/docs/api/reference',
    blurb: 'MySQL branches, schema diffs and deploy requests.',
  },
  {
    id: 'turso',
    name: 'Turso',
    category: 'Backend & data',
    env: ['TURSO_AUTH_TOKEN'],
    docs: 'https://docs.turso.tech/api-reference',
    blurb: 'SQLite databases at the edge.',
  },
  {
    id: 'mongodb',
    name: 'MongoDB Atlas',
    category: 'Backend & data',
    env: ['MONGODB_URI'],
    docs: 'https://www.mongodb.com/docs/api/doc/atlas-admin-api-v2/',
    blurb: 'Clusters, collections and document queries.',
  },
  {
    id: 'upstash',
    name: 'Upstash',
    category: 'Backend & data',
    env: ['UPSTASH_REDIS_REST_TOKEN'],
    docs: 'https://upstash.com/docs/redis/features/restapi',
    blurb: 'Serverless Redis and QStash over REST.',
  },

  // ---------------- AI & ML ----------------
  {
    id: 'huggingface',
    name: 'Hugging Face',
    category: 'AI & ML',
    env: ['HF_TOKEN'],
    publicRead: true,
    api: 'https://huggingface.co/api',
    auth: bearer('HF_TOKEN'),
    docs: 'https://huggingface.co/docs/api-inference/index',
    blurb: 'Models, datasets, spaces and model cards.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'AI & ML',
    env: ['OPENAI_API_KEY'],
    api: 'https://api.openai.com/v1',
    auth: bearer('OPENAI_API_KEY'),
    docs: 'https://platform.openai.com/docs/api-reference',
    blurb: 'Models, files and completions.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'AI & ML',
    env: ['ANTHROPIC_API_KEY'],
    docs: 'https://docs.anthropic.com/en/api/',
    blurb: 'Claude models and message batches.',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    category: 'AI & ML',
    env: ['REPLICATE_API_TOKEN'],
    api: 'https://api.replicate.com/v1',
    auth: bearer('REPLICATE_API_TOKEN'),
    docs: 'https://replicate.com/docs/reference/http',
    blurb: 'Run open models and poll predictions.',
  },
  {
    id: 'kaggle',
    name: 'Kaggle',
    category: 'AI & ML',
    env: ['KAGGLE_USERNAME', 'KAGGLE_KEY'],
    docs: 'https://www.kaggle.com/docs/api',
    blurb: 'Datasets, notebooks and competitions.',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    category: 'AI & ML',
    env: [],
    local: true,
    docs: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
    blurb: 'Local models on your own machine, no key needed.',
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'AI & ML',
    env: ['GROQ_API_KEY'],
    api: 'https://api.groq.com/openai/v1',
    auth: bearer('GROQ_API_KEY'),
    docs: 'https://console.groq.com/docs/api-reference',
    blurb: 'Fast Llama, Mixtral and Whisper inference.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'AI & ML',
    env: ['OPENROUTER_API_KEY'],
    api: 'https://openrouter.ai/api/v1',
    auth: bearer('OPENROUTER_API_KEY'),
    docs: 'https://openrouter.ai/docs/api-reference/overview',
    blurb: 'One endpoint across hundreds of hosted models.',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    category: 'AI & ML',
    env: ['MISTRAL_API_KEY'],
    docs: 'https://docs.mistral.ai/api/',
    blurb: 'Mistral and Codestral models plus embeddings.',
  },
  {
    id: 'wandb',
    name: 'Weights & Biases',
    category: 'AI & ML',
    env: ['WANDB_API_KEY'],
    docs: 'https://docs.wandb.ai/ref/python/',
    blurb: 'Experiment tracking, sweeps and model artifacts.',
  },

  // ---------------- design ----------------
  {
    id: 'figma',
    name: 'Figma',
    category: 'Design',
    env: ['FIGMA_TOKEN'],
    docs: 'https://www.figma.com/developers/api',
    blurb: 'Files, components and exported assets.',
  },
  {
    id: 'iconify',
    name: 'Iconify',
    category: 'Design',
    env: [],
    docs: 'https://iconify.design/docs/api/',
    blurb: '200k+ open icon sets as SVG or JSON, no key needed.',
  },
  {
    id: 'canva',
    name: 'Canva',
    category: 'Design',
    env: ['CANVA_TOKEN'],
    docs: 'https://www.canva.dev/docs/connect/api-reference/',
    blurb: 'Designs, assets and exports via Canva Connect.',
  },
  {
    id: 'framer',
    name: 'Framer',
    category: 'Design',
    env: ['FRAMER_TOKEN'],
    docs: 'https://www.framer.com/developers/',
    blurb: 'Sites, CMS collections and publish states.',
  },

  // ---------------- team & comms ----------------
  {
    id: 'notion',
    name: 'Notion',
    category: 'Team & comms',
    env: ['NOTION_TOKEN'],
    api: 'https://api.notion.com/v1',
    auth: bearer('NOTION_TOKEN'),
    extraHeaders: { 'Notion-Version': '2022-06-28' },
    docs: 'https://developers.notion.com/reference',
    blurb: 'Pages, databases and blocks.',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Team & comms',
    env: ['SLACK_BOT_TOKEN'],
    api: 'https://slack.com/api',
    auth: bearer('SLACK_BOT_TOKEN'),
    docs: 'https://api.slack.com/methods',
    blurb: 'Channels, messages and files.',
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Team & comms',
    env: ['DISCORD_BOT_TOKEN'],
    docs: 'https://discord.com/developers/docs/reference',
    blurb: 'Guilds, channels and webhooks.',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Team & comms',
    env: ['LINEAR_API_KEY'],
    docs: 'https://developers.linear.app/docs',
    blurb: 'Issues, cycles and projects over GraphQL.',
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'Team & comms',
    env: ['JIRA_API_TOKEN'],
    docs: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    blurb: 'Issues, sprints and boards.',
  },
  {
    id: 'trello',
    name: 'Trello',
    category: 'Team & comms',
    env: ['TRELLO_API_KEY', 'TRELLO_TOKEN'],
    docs: 'https://developer.atlassian.com/cloud/trello/rest/',
    blurb: 'Boards, lists and cards.',
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'Team & comms',
    env: ['ASANA_TOKEN'],
    docs: 'https://developers.asana.com/reference',
    blurb: 'Projects, tasks and custom fields.',
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    category: 'Team & comms',
    env: ['MASTODON_TOKEN'],
    docs: 'https://docs.joinmastodon.org/api/',
    blurb: 'Public timelines, accounts and posts on the fediverse.',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    category: 'Team & comms',
    env: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
    docs: 'https://docs.bsky.app/docs/category/http-reference',
    blurb: 'AT Protocol profiles, posts and feeds.',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'Team & comms',
    env: ['AIRTABLE_TOKEN'],
    docs: 'https://airtable.com/developers/web/api/introduction',
    blurb: 'Bases, tables and records as a REST database.',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    category: 'Team & comms',
    env: ['CLICKUP_TOKEN'],
    docs: 'https://developer.clickup.com/reference',
    blurb: 'Spaces, lists and tasks across a workspace.',
  },
  {
    id: 'resend',
    name: 'Resend',
    category: 'Team & comms',
    env: ['RESEND_API_KEY'],
    docs: 'https://resend.com/docs/api-reference/introduction',
    blurb: 'Transactional email, domains and delivery logs.',
  },

  // ---------------- monitoring ----------------
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'Monitoring',
    env: ['SENTRY_AUTH_TOKEN'],
    api: 'https://sentry.io/api/0',
    auth: bearer('SENTRY_AUTH_TOKEN'),
    docs: 'https://docs.sentry.io/api/',
    blurb: 'Projects, releases and issue details.',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    category: 'Monitoring',
    env: ['DD_API_KEY'],
    docs: 'https://docs.datadoghq.com/api/latest/',
    blurb: 'Metrics, monitors and dashboards.',
  },
  {
    id: 'posthog',
    name: 'PostHog',
    category: 'Monitoring',
    env: ['POSTHOG_API_KEY'],
    docs: 'https://posthog.com/docs/api',
    blurb: 'Product analytics, funnels, flags and session replay.',
  },
  {
    id: 'grafana',
    name: 'Grafana',
    category: 'Monitoring',
    env: ['GRAFANA_TOKEN'],
    docs: 'https://grafana.com/docs/grafana/latest/developers/http_api/',
    blurb: 'Dashboards, alert rules and data sources.',
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    category: 'Monitoring',
    env: ['PAGERDUTY_TOKEN'],
    docs: 'https://developer.pagerduty.com/api-reference/',
    blurb: 'Incidents, on-call schedules and services.',
  },

  // ---------------- editor ----------------
  {
    id: 'vscode',
    name: 'VS Code',
    category: 'Editor',
    env: [],
    local: true,
    docs: 'https://code.visualstudio.com/docs/editor/workspaces',
    blurb: 'Export the workspace as a ZIP and open it locally.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'Editor',
    env: [],
    docs: 'https://docs.cursor.com/',
    blurb: 'Open the workspace in Cursor with its AI edits.',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains IDEs',
    category: 'Editor',
    env: [],
    docs: 'https://www.jetbrains.com/help/idea/opening-files.html',
    blurb: 'IntelliJ, WebStorm and friends on the same folder.',
  },
  {
    id: 'replit',
    name: 'Replit',
    category: 'Editor',
    env: [],
    docs: 'https://docs.replit.com/',
    blurb: 'Cloud IDE with hosting and a package manager.',
  },
  {
    id: 'gitpod',
    name: 'Gitpod',
    category: 'Editor',
    env: ['GITPOD_TOKEN'],
    docs: 'https://www.gitpod.io/docs/references/gitpod-public-api',
    blurb: 'Ephemeral cloud dev environments from a repo.',
  },
];

/**
 * Token-free access. Every platform in the catalog is reachable without an API
 * token: either its public REST API answers anonymous GETs (`api` + `probe`),
 * or the agent reads it in its own browser (`site`). A token only unlocks
 * private or write actions — it is never required to connect.
 */
const TOKEN_FREE = {
  github: { api: 'https://api.github.com', probe: '/rate_limit' },
  gitlab: { api: 'https://gitlab.com/api/v4', probe: '/projects?per_page=1' },
  bitbucket: { api: 'https://api.bitbucket.org/2.0', probe: '/repositories/atlassian?pagelen=1' },
  codeberg: { api: 'https://codeberg.org/api/v1', probe: '/repos/search?limit=1' },
  cloudflare: { api: 'https://api.cloudflare.com/client/v4', probe: '/ips' },
  npm: { api: 'https://registry.npmjs.org', probe: '/react' },
  pypi: { api: 'https://pypi.org/pypi', probe: '/requests/json' },
  dockerhub: { api: 'https://hub.docker.com/v2', probe: '/repositories/library/nginx/' },
  crates: { api: 'https://crates.io/api/v1', probe: '/crates/serde' },
  rubygems: { api: 'https://rubygems.org/api/v1', probe: '/gems/rails.json' },
  huggingface: { api: 'https://huggingface.co/api', probe: '/models?limit=1' },
  slack: { api: 'https://slack.com/api', probe: '/api.test' },
  sentry: { api: 'https://sentry.io/api/0', probe: '/' },
  discord: { api: 'https://discord.com/api/v10', probe: '/gateway' },
  kaggle: { api: 'https://www.kaggle.com/api/v1', probe: '/datasets/list?page=1' },
  maven: {
    api: 'https://search.maven.org',
    probe: '/solrsearch/select?q=g:com.google.guava&rows=1&wt=json',
  },
  nuget: { api: 'https://api.nuget.org/v3', probe: '/index.json' },
  packagist: { api: 'https://repo.packagist.org', probe: '/p2/monolog/monolog.json' },
  pubdev: { api: 'https://pub.dev/api', probe: '/packages/http' },
  hex: { api: 'https://hex.pm/api', probe: '/packages/phoenix' },
  openrouter: { api: 'https://openrouter.ai/api/v1', probe: '/models' },
  iconify: { api: 'https://api.iconify.design', probe: '/collections' },
  mastodon: { api: 'https://mastodon.social/api/v1', probe: '/instance' },
  bluesky: {
    api: 'https://public.api.bsky.app/xrpc',
    probe: '/app.bsky.actor.getProfile?actor=bsky.app',
  },

  gitea: { site: 'https://gitea.com' },
  vercel: { site: 'https://vercel.com' },
  netlify: { site: 'https://app.netlify.com' },
  railway: { site: 'https://railway.com' },
  render: { site: 'https://render.com' },
  flyio: { site: 'https://fly.io' },
  heroku: { site: 'https://dashboard.heroku.com' },
  digitalocean: { site: 'https://cloud.digitalocean.com' },
  aws: { site: 'https://aws.amazon.com' },
  gcp: { site: 'https://cloud.google.com' },
  azure: { site: 'https://portal.azure.com' },
  supabase: { site: 'https://supabase.com' },
  firebase: { site: 'https://console.firebase.google.com' },
  neon: { site: 'https://console.neon.tech' },
  planetscale: { site: 'https://app.planetscale.com' },
  turso: { site: 'https://turso.tech' },
  mongodb: { site: 'https://cloud.mongodb.com' },
  upstash: { site: 'https://console.upstash.com' },
  openai: { site: 'https://openai.com' },
  anthropic: { site: 'https://console.anthropic.com' },
  replicate: { site: 'https://replicate.com' },
  figma: { site: 'https://www.figma.com' },
  notion: { site: 'https://www.notion.so' },
  linear: { site: 'https://linear.app' },
  jira: { site: 'https://www.atlassian.com/software/jira' },
  trello: { site: 'https://trello.com' },
  asana: { site: 'https://app.asana.com' },
  datadog: { site: 'https://app.datadoghq.com' },
  koyeb: { site: 'https://app.koyeb.com' },
  denodeploy: { site: 'https://dash.deno.com' },
  groq: { site: 'https://console.groq.com' },
  mistral: { site: 'https://console.mistral.ai' },
  wandb: { site: 'https://wandb.ai' },
  canva: { site: 'https://www.canva.com' },
  framer: { site: 'https://www.framer.com' },
  airtable: { site: 'https://airtable.com' },
  clickup: { site: 'https://app.clickup.com' },
  resend: { site: 'https://resend.com' },
  posthog: { site: 'https://us.posthog.com' },
  grafana: { site: 'https://grafana.com' },
  pagerduty: { site: 'https://www.pagerduty.com' },
  cursor: { site: 'https://cursor.com' },
  jetbrains: { site: 'https://www.jetbrains.com' },
  replit: { site: 'https://replit.com' },
  gitpod: { site: 'https://gitpod.io' },
};

for (const platform of PLATFORMS) {
  const access = TOKEN_FREE[platform.id];
  if (!access) continue;
  if (access.api) platform.api = access.api;
  if (access.probe) {
    platform.probe = access.probe;
    platform.publicRead = true;
  }
  if (access.site) platform.site = access.site;
}

export function findPlatform(id) {
  return PLATFORMS.find((platform) => platform.id === id) || null;
}

/** Catalog plus live connection state, derived from the env vars present now. */
export function listPlatforms() {
  return PLATFORMS.map((platform) => {
    const configured =
      platform.env.length > 0 && platform.env.every((name) => Boolean(process.env[name]));
    const mode = configured
      ? 'connected'
      : platform.local
        ? 'local'
        : platform.publicRead
          ? 'public'
          : 'browser';
    return {
      id: platform.id,
      name: platform.name,
      category: platform.category,
      blurb: platform.blurb,
      docs: platform.docs,
      site: platform.site || null,
      api: platform.api || null,
      probe: platform.probe || null,
      env: platform.env,
      mode,
      connected: configured,
      tokenFree: true,
      tokenOptional: platform.env.length > 0,
      readable: Boolean(platform.api) && (configured || Boolean(platform.publicRead)),
    };
  });
}

const PROBE_TIMEOUT_MS = 6000;
const PROBE_CACHE_MS = 5 * 60_000;
const PROBE_UA = 'Orbit/1.0 (+https://base44.app)';

let probeCache = { at: 0, data: null };

/** One anonymous GET: a public API probe when the platform has one, else its site. */
async function probeOne(platform) {
  const target =
    platform.api && platform.probe ? `${platform.api}${platform.probe}` : platform.site;
  if (!target) {
    return { reachable: platform.mode === 'local', status: null, checked: null };
  }
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': PROBE_UA, Accept: 'application/json, text/html;q=0.9' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return { reachable: true, status: res.status, checked: target };
  } catch (error) {
    return { reachable: false, status: null, error: error.message, checked: target };
  }
}

/** Catalog with a live, token-free reachability check (cached for a few minutes). */
export async function platformStatuses({ refresh = false } = {}) {
  if (!refresh && probeCache.data && Date.now() - probeCache.at < PROBE_CACHE_MS) {
    return probeCache.data;
  }
  const base = listPlatforms();
  const probes = await Promise.all(base.map(probeOne));
  const data = base.map((platform, index) => ({ ...platform, ...probes[index] }));
  probeCache = { at: Date.now(), data };
  return data;
}
