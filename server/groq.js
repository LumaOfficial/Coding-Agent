const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', note: 'Best for agentic coding + tools' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', note: 'Fast and cheap' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen3 27B', note: 'Good at code edits' },
];

export function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Streams a chat completion from Groq's OpenAI-compatible endpoint.
 * Yields { type: 'text', value } and finally { type: 'tool_calls', calls }.
 */
export async function* streamCompletion({ model, messages, tools, signal }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error = new Error('No Groq API key configured. Add GROQ_API_KEY in the Integrations panel.');
    error.status = 400;
    throw error;
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 8000,
      ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`Groq error ${res.status}: ${body.slice(0, 400)}`);
    error.status = res.status;
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const calls = [];
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      for (const rawLine of chunk.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) yield { type: 'text', value: delta.content };

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0;
            calls[index] ||= { id: '', name: '', arguments: '' };
            if (tc.id) calls[index].id = tc.id;
            if (tc.function?.name) calls[index].name += tc.function.name;
            if (tc.function?.arguments) calls[index].arguments += tc.function.arguments;
          }
        }
      }
    }
  }

  const finished = calls
    .filter(Boolean)
    .map((call, i) => ({
      id: call.id || `call_${Date.now()}_${i}`,
      name: call.name,
      arguments: call.arguments || '{}',
    }))
    .filter((call) => call.name);

  if (finished.length) yield { type: 'tool_calls', calls: finished };
}
