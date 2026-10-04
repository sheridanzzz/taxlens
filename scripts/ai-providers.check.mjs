import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import worker from '../cloudflare/ai-backup/worker.mjs';

const nativeRequire = createRequire(import.meta.url);
const savedEnv = { ...process.env };
const source = ts.transpileModule(readFileSync('src/lib/ai-providers.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const configure = () => {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'synthetic-google';
  process.env.GROQ_API_KEY = 'synthetic-groq';
  process.env.CLOUDFLARE_AI_BASE_URL = 'https://backup.example.test/v1';
  process.env.CLOUDFLARE_AI_API_KEY = 'synthetic-cloudflare';
};
function load(generate) {
  const compiled = { exports: {} };
  const provider = () => id => ({ id });
  const require = name => name === '@ai-sdk/google' ? { createGoogleGenerativeAI: provider }
    : name === '@ai-sdk/groq' ? { createGroq: provider }
    : name === '@ai-sdk/openai' ? { createOpenAI: () => ({ chat: id => ({ id }) }) }
    : name === 'ai' ? { generateText: generate } : nativeRequire(name);
  runInThisContext(`(function(require,module,exports){${source}\n})`)(require, compiled, compiled.exports);
  return compiled.exports;
}
const messages = [{ role: 'user', content: 'Synthetic receipt: a software subscription.' }];
let checks = 0;
const check = async (name, run) => { configure(); await run(); checks++; console.log(`✓ ${name}`); };

try {
  await check('Google and Groq outages reach an independent Cloudflare model', async () => {
    const seen = [];
    const ai = load(async options => { seen.push(options.model.id); if (!options.model.id.startsWith('@cf/')) throw Error('Synthetic outage'); return { text: 'Synthetic answer' }; });
    assert.equal((await ai.generateTextWithFallback(messages, 200)).modelKey, 'cloudflareText');
    assert.deepEqual(seen, ['gemini-3.5-flash', 'qwen/qwen3.8-27b', '@cf/openai/gpt-oss-120b']);
  });
  await check('Cloudflare-only configuration can run the receipt shortlist', async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY; delete process.env.GROQ_API_KEY;
    const ai = load(async () => ({ text: 'Synthetic answer' }));
    assert.equal(ai.hasAiProvider(), true);
    assert.equal((await ai.generateTextWithFallback(messages, 200)).modelKey, 'cloudflareText');
  });
  await check('Image receipts skip text-only backups and retain vision input', async () => {
    const seen = [];
    const imageMessages = [{ role: 'user', content: [{ type: 'text', text: 'Synthetic receipt' }, { type: 'image', image: 'data:image/png;base64,fixture' }] }];
    const ai = load(async options => { seen.push(options.model.id); assert.deepEqual(options.messages, imageMessages); if (options.model.id !== '@cf/google/gemma-4-26b-a4b-it') throw Error('Synthetic outage'); return { text: 'Synthetic answer' }; });
    assert.equal((await ai.generateTextWithFallback(imageMessages, 200)).modelKey, 'cloudflareVision');
    assert.deepEqual(seen, ['gemini-3.5-flash', 'qwen/qwen3.8-27b', '@cf/google/gemma-4-26b-a4b-it']);
  });
  await check('Empty answers advance to a backup instead of reporting success', async () => {
    const ai = load(async options => ({ text: options.model.id.startsWith('gemini') ? ' ' : 'Synthetic answer' }));
    assert.equal((await ai.generateTextWithFallback(messages, 200)).modelKey, 'quality');
  });
  await check('Failed models cool down while working models remain available', async () => {
    const seen = [];
    const ai = load(async options => { seen.push(options.model.id); if (options.model.id.startsWith('gemini')) throw Error('Synthetic exhausted quota'); return { text: 'Synthetic answer' }; });
    await ai.generateTextWithFallback(messages, 200); await ai.generateTextWithFallback(messages, 200);
    assert.deepEqual(seen, ['gemini-3.5-flash', 'qwen/qwen3.8-27b', 'qwen/qwen3.8-27b']);
  });
  await check('A slow model times out and the next model can finish', async () => {
    const ai = load(options => options.model.id.startsWith('gemini') ? new Promise((_, reject) => {
      const timer = setTimeout(() => reject(Error('Test timeout failed')), 1000);
      options.abortSignal.addEventListener('abort', () => { clearTimeout(timer); reject(Error('Synthetic model timeout')); }, { once: true });
    }) : Promise.resolve({ text: 'Synthetic answer' }));
    assert.equal((await ai.generateTextWithFallback(messages, 200, { modelTimeoutMs: 15 })).modelKey, 'quality');
  });
  await check('An aborted request does not start another model', async () => {
    let calls = 0; const controller = new AbortController(); controller.abort();
    const ai = load(async () => { calls++; return { text: 'Unused' }; });
    await assert.rejects(ai.generateTextWithFallback(messages, 200, { signal: controller.signal }));
    assert.equal(calls, 0);
  });

  const request = body => new Request('https://backup.example.test/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer synthetic-bridge-key' }, body: JSON.stringify(body) });
  const env = { LEDGR_API_KEY: 'synthetic-bridge-key', AI_RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: { run: async () => ({ response: 'Synthetic answer' }) } };
  await check('The private bridge rejects unauthenticated calls and paid models', async () => {
    assert.equal((await worker.fetch(new Request('https://backup.example.test/v1/chat/completions', { method: 'POST', body: '{}' }), env)).status, 401);
    assert.equal((await worker.fetch(request({ model: '@cf/deepseek-ai/deepseek-v4-pro-0813', messages }), env)).status, 400);
    assert.equal((await worker.fetch(request(null), env)).status, 400);
  });
  await check('The bridge normalizes Mistral output and bounds token requests', async () => {
    let input;
    const response = await worker.fetch(request({ model: '@cf/mistralai/mistral-small-3.1-24b-instruct', messages, max_tokens: 90000 }), { ...env, AI: { run: async (_model, body) => { input = body; return { response: 'Synthetic answer' }; } } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).choices[0].message.content, 'Synthetic answer');
    assert.equal(input.max_tokens, 7000);
  });
  await check('The bridge rejects oversized requests and handles quota failures', async () => {
    const large = request({}); large.headers.set('content-length', String(5 * 1024 * 1024));
    assert.equal((await worker.fetch(large, env)).status, 413);
    assert.equal((await worker.fetch(request({ model: '@cf/openai/gpt-oss-120b', messages }), { ...env, AI: { run: async () => { throw Error('Synthetic quota exhausted'); } } })).status, 503);
  });
} finally {
  for (const key of ['GOOGLE_GENERATIVE_AI_API_KEY', 'GROQ_API_KEY', 'CLOUDFLARE_AI_BASE_URL', 'CLOUDFLARE_AI_API_KEY']) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
}
console.log(`${checks} AI provider checks passed.`);
