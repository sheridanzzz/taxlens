// A private bridge lets Vercel use the Workers AI binding without storing a
// Cloudflare account token. Only these free-allocation models are accepted.
export const ALLOWED_MODELS = new Set([
  '@cf/openai/gpt-oss-120b',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
]);
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});
const failure = (message, status) => json({ error: { message, type: 'api_error' } }, status);

async function matchesSecret(actual, expected) {
  if (!actual || !expected) return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(actual), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

const worker = {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return json({ service: 'ledgr-ai-backup', configured: !!env.LEDGR_API_KEY && !!env.AI });
    if (path !== '/v1/chat/completions') return failure('Not found.', 404);
    if (request.method !== 'POST') return failure('Use POST.', 405);
    const key = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!(await matchesSecret(key, env.LEDGR_API_KEY))) return failure('Unauthorized.', 401);
    if (!(await env.AI_RATE_LIMITER.limit({ key: 'ledgr' })).success) return failure('AI backup is busy. Try again shortly.', 429);
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return failure('Receipt image is too large.', 413);
    let body;
    try {
      const reader = request.body?.getReader();
      if (!reader) return failure('Missing body.', 400);
      const chunks = []; let length = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > MAX_BODY_BYTES) { await reader.cancel(); return failure('Receipt image is too large.', 413); }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return failure('Invalid JSON body.', 400); }
    if (!body || typeof body !== 'object' || !ALLOWED_MODELS.has(body.model)) return failure('Unsupported backup model.', 400);
    if (body.stream || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 64) return failure('Use non-streaming chat messages.', 400);
    const maxTokens = Math.max(1, Math.min(7000, Math.floor(Number(body.max_tokens ?? body.max_completion_tokens) || 2000)));
    const input = { messages: body.messages, max_tokens: maxTokens, stream: false };
    if (body.model === '@cf/openai/gpt-oss-120b') input.reasoning_effort = 'low';
    try {
      const result = await env.AI.run(body.model, input);
      // Newer models return Chat Completions; Mistral returns the older shape.
      if (Array.isArray(result?.choices)) return json(result);
      if (typeof result?.response !== 'string' || !result.response.trim()) return failure('AI backup returned no answer.', 502);
      return json({
        id: `ledgr-${crypto.randomUUID()}`, object: 'chat.completion',
        created: Math.floor(Date.now() / 1000), model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: result.response }, finish_reason: 'stop' }],
        ...(result.usage ? { usage: result.usage } : {}),
      });
    } catch { return failure('AI backup is temporarily unavailable.', 503); }
  },
};
export default worker;
