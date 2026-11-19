import { getMessages, addMessage, getSession } from './store.js';
import { streamCompletion } from './groq.js';
import { toolDefinitions, executeTool } from './tools/index.js';
import { SYSTEM_PROMPT } from './prompt.js';

const MAX_STEPS = 10;

function buildMessages(stored) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const m of stored) {
    if (m.role === 'assistant') {
      const entry = { role: 'assistant', content: m.content || null };
      if (m.tool_calls?.length) {
        entry.tool_calls = m.tool_calls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: c.arguments },
        }));
      }
      messages.push(entry);
    } else if (m.role === 'tool') {
      messages.push({ role: 'tool', tool_call_id: m.tool_call_id, content: m.content });
    } else if (m.role === 'user') {
      messages.push({ role: 'user', content: m.content });
    }
  }
  return messages;
}

function safeParseArgs(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

/**
 * Runs the agent loop for one user turn, emitting SSE events through `emit`.
 */
export async function runAgent({ sessionId, model, signal, emit }) {
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const messages = buildMessages(await getMessages(sessionId));

    let text = '';
    let toolCalls = [];

    for await (const event of streamCompletion({
      model,
      messages,
      tools: toolDefinitions,
      signal,
    })) {
      if (event.type === 'text') {
        text += event.value;
        emit({ type: 'text', delta: event.value });
      } else if (event.type === 'tool_calls') {
        toolCalls = event.calls;
      }
    }

    await addMessage(sessionId, {
      role: 'assistant',
      content: text,
      tool_calls: toolCalls.length ? toolCalls : undefined,
    });

    if (!toolCalls.length) {
      emit({ type: 'done' });
      return;
    }

    for (const call of toolCalls) {
      if (signal?.aborted) return;
      const args = safeParseArgs(call.arguments);
      emit({ type: 'tool_start', id: call.id, name: call.name, args });

      const result = await executeTool(call.name, args, { sessionId });

      await addMessage(sessionId, {
        role: 'tool',
        tool_call_id: call.id,
        name: call.name,
        content: result.content,
      });

      emit({
        type: 'tool_result',
        id: call.id,
        name: call.name,
        ok: result.ok,
        result: result.content.slice(0, 4000),
      });
    }
  }

  emit({
    type: 'text',
    delta: `\n\n_Stopped after ${MAX_STEPS} tool rounds. Ask me to continue if you need more._`,
  });
  emit({ type: 'done' });
}
