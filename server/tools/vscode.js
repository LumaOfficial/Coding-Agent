import { writeWorkspaceFile, listWorkspaceFiles } from '../store.js';

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'generate_vscode_workspace',
      description:
        'Add VS Code files to the workspace: a .code-workspace file, .vscode/settings.json and .vscode/tasks.json so the user can open the project directly in VS Code.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Workspace display name' },
        },
        required: ['name'],
      },
    },
  },
];

export const handlers = {
  async generate_vscode_workspace(args, ctx) {
    const name = (args.name || 'project').replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'project';
    const files = await listWorkspaceFiles(ctx.sessionId);

    const hasNode = files.some((f) => f.path === 'package.json');
    const hasPython = files.some(
      (f) => f.path === 'requirements.txt' || f.path === 'pyproject.toml'
    );

    const tasks = {
      version: '2.0.0',
      tasks: hasNode
        ? [
            {
              label: 'install',
              type: 'shell',
              command: 'npm install',
              problemMatcher: [],
            },
            {
              label: 'dev',
              type: 'shell',
              command: 'npm run dev',
              group: { kind: 'build', isDefault: true },
              problemMatcher: [],
            },
          ]
        : hasPython
          ? [
              {
                label: 'install',
                type: 'shell',
                command: 'pip install -r requirements.txt',
                problemMatcher: [],
              },
            ]
          : [],
    };

    const settings = {
      'editor.formatOnSave': true,
      'files.trimTrailingWhitespace': true,
      'editor.tabSize': 2,
      'files.exclude': { '**/.git': true, '**/node_modules': true },
    };

    await writeWorkspaceFile(
      ctx.sessionId,
      `${name}.code-workspace`,
      JSON.stringify(
        {
          folders: [{ path: '.' }],
          settings: { 'editor.formatOnSave': true },
        },
        null,
        2
      )
    );
    await writeWorkspaceFile(ctx.sessionId, '.vscode/settings.json', JSON.stringify(settings, null, 2));
    await writeWorkspaceFile(ctx.sessionId, '.vscode/tasks.json', JSON.stringify(tasks, null, 2));

    return `Added ${name}.code-workspace, .vscode/settings.json and .vscode/tasks.json. Export the workspace as a ZIP and open the folder in VS Code.`;
  },
};
