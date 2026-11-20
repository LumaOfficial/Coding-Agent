const HF = 'https://huggingface.co/api';

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.HF_TOKEN) h.Authorization = `Bearer ${process.env.HF_TOKEN}`;
  return h;
}

async function get(path) {
  const res = await fetch(`${HF}${path}`, { headers: headers() });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Hugging Face ${res.status}: ${data.error || text.slice(0, 300)}`);
  }
  return data;
}

function summarize(items, kind) {
  if (!items?.length) return `No ${kind} found.`;
  return items
    .map((item) => {
      const id = item.id || item.modelId;
      const downloads = item.downloads ?? 0;
      const likes = item.likes ?? 0;
      const tags = (item.tags || []).filter((t) => !t.includes(':')).slice(0, 4).join(', ');
      return `${id} — ${downloads} downloads, ${likes} likes${tags ? ` [${tags}]` : ''}`;
    })
    .join('\n');
}

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'hf_search_models',
      description: 'Search Hugging Face models by keyword.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hf_search_datasets',
      description: 'Search Hugging Face datasets by keyword.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hf_search_spaces',
      description: 'Search Hugging Face Spaces (hosted demos) by keyword.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hf_model_info',
      description: 'Get the model card and metadata for a Hugging Face model id.',
      parameters: {
        type: 'object',
        properties: { model_id: { type: 'string', description: 'e.g. meta-llama/Llama-3.1-8B-Instruct' } },
        required: ['model_id'],
      },
    },
  },
];

export const handlers = {
  async hf_search_models(args) {
    const data = await get(
      `/models?search=${encodeURIComponent(args.query)}&sort=downloads&direction=-1&limit=8`
    );
    return summarize(data, 'models');
  },
  async hf_search_datasets(args) {
    const data = await get(
      `/datasets?search=${encodeURIComponent(args.query)}&sort=downloads&direction=-1&limit=8`
    );
    return summarize(data, 'datasets');
  },
  async hf_search_spaces(args) {
    const data = await get(`/spaces?search=${encodeURIComponent(args.query)}&limit=8`);
    return summarize(data, 'spaces');
  },
  async hf_model_info(args) {
    const data = await get(`/models/${args.model_id}`);
    const card = data.cardData || {};
    const parts = [
      `Model: ${data.id}`,
      `Downloads: ${data.downloads ?? 0}  Likes: ${data.likes ?? 0}`,
      `Pipeline: ${data.pipeline_tag || 'n/a'}`,
      `License: ${card.license || 'n/a'}`,
      `Tags: ${(data.tags || []).slice(0, 10).join(', ')}`,
    ];
    if (card.summary) parts.push(`\n${card.summary}`);
    if (data.siblings?.length) {
      parts.push(`\nFiles: ${data.siblings.slice(0, 20).map((s) => s.rfilename).join(', ')}`);
    }
    return parts.join('\n');
  },
};
