import * as workspace from './workspace.js';
import * as github from './github.js';
import * as huggingface from './huggingface.js';
import * as vscode from './vscode.js';

const modules = [workspace, github, huggingface, vscode];

export const toolDefinitions = modules.flatMap((m) => m.definitions);

const handlerMap = new Map();
for (const mod of modules) {
  for (const [name, fn] of Object.entries(mod.handlers)) handlerMap.set(name, fn);
}

const MAX_RESULT = 14000;

export function describeTool(name) {
  return toolDefinitions.find((t) => t.function.name === name)?.function.description || name;
}

export async function executeTool(name, args, ctx) {
  const handler = handlerMap.get(name);
  if (!handler) return { ok: false, content: `Unknown tool: ${name}` };
  try {
    const result = await handler(args || {}, ctx);
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    return {
      ok: true,
      content: text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}\n…(truncated)` : text,
    };
  } catch (error) {
    return { ok: false, content: `Error: ${error.message}` };
  }
}
