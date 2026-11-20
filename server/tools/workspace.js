import {
  writeWorkspaceFile,
  readWorkspaceFile,
  deleteWorkspaceFile,
  listWorkspaceFiles,
} from '../store.js';
import { requestConsent, declined } from '../consent.js';

async function fileExists(sessionId, relPath) {
  try {
    await readWorkspaceFile(sessionId, relPath);
    return true;
  } catch {
    return false;
  }
}

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create or overwrite a file in the user workspace. Always pass the complete file contents.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path, e.g. src/app.js' },
          content: { type: 'string', description: 'Full file contents' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from the workspace by relative path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List every file currently in the workspace.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file or folder from the workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
];

export const handlers = {
  async write_file(args, ctx) {
    if (await fileExists(ctx.sessionId, args.path)) {
      const allowed = await requestConsent(ctx, {
        action: 'write_file',
        title: 'Overwrite an existing file?',
        summary: ` ${args.path}`,
        detail: 'The file already exists in the workspace — its current contents will be replaced.',
        risk: 'write',
      });
      if (!allowed) return declined('overwrite');
    }
    const path = await writeWorkspaceFile(ctx.sessionId, args.path, args.content ?? '');
    return `Wrote ${(args.content ?? '').length} characters to ${path}`;
  },
  async read_file(args, ctx) {
    return await readWorkspaceFile(ctx.sessionId, args.path);
  },
  async list_files(args, ctx) {
    const files = await listWorkspaceFiles(ctx.sessionId);
    if (!files.length) return 'Workspace is empty.';
    return files.map((f) => `${f.path} (${f.size} bytes)`).join('\n');
  },
  async delete_file(args, ctx) {
    const allowed = await requestConsent(ctx, {
      action: 'delete_file',
      title: 'Delete this from the workspace?',
      summary: ` ${args.path}`,
      detail: 'The file or folder is removed from this session. This cannot be undone.',
      risk: 'destructive',
    });
    if (!allowed) return declined('delete');
    await deleteWorkspaceFile(ctx.sessionId, args.path);
    return `Deleted ${args.path}`;
  },
};
