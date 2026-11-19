import { fixWorkspace, analyzeCode } from '../autofix.js';

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'autofix_workspace',
      description:
        'Repair and debug every file in the workspace: applies safe fixes (line endings, whitespace, tabs, trailing commas, debugger statements, final newline) and reports syntax errors, invalid JSON, missing imports, unbalanced braces and unclosed tags with file and line. Runs locally, no model or API key.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_code',
      description:
        'Repair and debug one code snippet without writing it to the workspace. Returns the fixed code plus any remaining problems. Runs locally, no model or API key.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The source code to check' },
          path: {
            type: 'string',
            description: 'Filename used to pick the checks, e.g. app.js, data.json, styles.css',
          },
        },
        required: ['code'],
      },
    },
  },
];

export const handlers = {
  async autofix_workspace(args, ctx) {
    return fixWorkspace(ctx.sessionId);
  },
  async check_code(args) {
    const filePath = args.path || 'snippet.js';
    const result = analyzeCode(args.code || '', filePath);
    return { path: filePath, ...result };
  },
};
