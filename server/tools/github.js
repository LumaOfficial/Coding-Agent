const API = 'https://api.github.com';

function token() {
  return process.env.GITHUB_TOKEN || '';
}

async function gh(path, { method = 'GET', body } = {}) {
  if (!token()) {
    throw new Error(
      'GITHUB_TOKEN is not configured. Add a personal access token with repo scope in the Integrations panel.'
    );
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${data.message || text.slice(0, 300)}`);
  }
  return data;
}

const repoArgs = {
  owner: { type: 'string', description: 'Repository owner (user or org)' },
  repo: { type: 'string', description: 'Repository name' },
};

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'github_search_repos',
      description: 'Search GitHub repositories by keyword, sorted by stars.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query, e.g. "fastapi auth"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_dir',
      description: 'List files and folders at a path in a GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          ...repoArgs,
          path: { type: 'string', description: 'Directory path, empty for root' },
          ref: { type: 'string', description: 'Branch or commit, defaults to default branch' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_read_file',
      description: 'Read a text file from a GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          ...repoArgs,
          path: { type: 'string' },
          ref: { type: 'string' },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_branch',
      description: 'Create a branch in a GitHub repository from an existing branch.',
      parameters: {
        type: 'object',
        properties: {
          ...repoArgs,
          branch: { type: 'string', description: 'New branch name' },
          from: { type: 'string', description: 'Source branch, defaults to the default branch' },
        },
        required: ['owner', 'repo', 'branch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_commit_file',
      description:
        'Create or update a file on a branch of a GitHub repository. Creates a commit.',
      parameters: {
        type: 'object',
        properties: {
          ...repoArgs,
          path: { type: 'string' },
          content: { type: 'string', description: 'Full file contents (plain text)' },
          message: { type: 'string', description: 'Commit message' },
          branch: { type: 'string', description: 'Target branch' },
        },
        required: ['owner', 'repo', 'path', 'content', 'message', 'branch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_open_pull_request',
      description: 'Open a pull request from a branch into a base branch.',
      parameters: {
        type: 'object',
        properties: {
          ...repoArgs,
          title: { type: 'string' },
          head: { type: 'string', description: 'Branch containing the changes' },
          base: { type: 'string', description: 'Branch to merge into, e.g. main' },
          body: { type: 'string', description: 'Pull request description' },
        },
        required: ['owner', 'repo', 'title', 'head', 'base'],
      },
    },
  },
];

export const handlers = {
  async github_search_repos(args) {
    const data = await gh(
      `/search/repositories?q=${encodeURIComponent(args.query)}&sort=stars&order=desc&per_page=6`
    );
    return data.items
      .map(
        (r) =>
          `${r.full_name} — ${r.stargazers_count}★ — ${r.language || 'n/a'}\n  ${r.description || ''}`
      )
      .join('\n');
  },

  async github_list_dir(args) {
    const q = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : '';
    const data = await gh(
      `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path || '')}${q}`
    );
    if (!Array.isArray(data)) return `Not a directory: ${args.path}`;
    return data.map((e) => `${e.type === 'dir' ? 'dir ' : 'file'}  ${e.path}`).join('\n');
  },

  async github_read_file(args) {
    const q = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : '';
    const data = await gh(
      `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path)}${q}`
    );
    if (Array.isArray(data)) return 'That path is a directory — use github_list_dir.';
    if (!data.content) return 'File is empty or binary.';
    return Buffer.from(data.content, 'base64').toString('utf8');
  },

  async github_create_branch(args) {
    const info = await gh(`/repos/${args.owner}/${args.repo}`);
    const source = args.from || info.default_branch;
    const ref = await gh(`/repos/${args.owner}/${args.repo}/git/ref/heads/${source}`);
    await gh(`/repos/${args.owner}/${args.repo}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/heads/${args.branch}`, sha: ref.object.sha },
    });
    return `Created branch ${args.branch} from ${source} (${ref.object.sha.slice(0, 7)})`;
  },

  async github_commit_file(args) {
    const base = `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path)}`;
    let sha;
    try {
      const existing = await gh(`${base}?ref=${encodeURIComponent(args.branch)}`);
      sha = existing.sha;
    } catch {
      sha = undefined;
    }
    const data = await gh(base, {
      method: 'PUT',
      body: {
        message: args.message,
        content: Buffer.from(args.content, 'utf8').toString('base64'),
        branch: args.branch,
        ...(sha ? { sha } : {}),
      },
    });
    return `${sha ? 'Updated' : 'Created'} ${args.path} on ${args.branch} — commit ${data.commit?.sha?.slice(0, 7)}`;
  },

  async github_open_pull_request(args) {
    const data = await gh(`/repos/${args.owner}/${args.repo}/pulls`, {
      method: 'POST',
      body: {
        title: args.title,
        head: args.head,
        base: args.base,
        body: args.body || '',
      },
    });
    return `Opened PR #${data.number}: ${data.html_url}`;
  },
};
