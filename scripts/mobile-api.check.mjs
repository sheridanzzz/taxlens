import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual mobile HTTP handlers with disposable, owned storage.
// The storage transaction and RLS are tested separately by storage.check.mjs.
const nativeRequire = createRequire(import.meta.url);
const owner = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
let signedIn = true, authCalls = 0, failure = '', parseFailure = false;
let original = 'data:message/rfc822;base64,ZmFrZQ==';
const calls = [];
const db = {};
for (const name of ['getSettings', 'getExpenses', 'getAssets', 'getWfhEntries', 'getWfhActualCosts', 'getCgtTransactions', 'getRentalProperties', 'getRentalTransactions', 'getExpenseReceipt', 'getExpenseReceipts', 'saveExpense']) {
  db[name] = async (...args) => {
    calls.push([name, ...args]);
    assert.equal(args[0], owner, `${name} must use the authenticated owner`);
    if (failure === name) throw Error('Injected storage failure');
    if (name === 'getSettings') return { financialYear: '2025-26' };
    if (name === 'getExpenses') return [{ id, hasReceipt: true }];
    if (name === 'getExpenseReceipt') return original;
    if (name === 'getExpenseReceipts') return { [id]: original };
    return [];
  };
}
const evidence = {
  receiptMime: () => 'message/rfc822',
  readEmailEvidence: async () => { if (parseFailure) throw Error('Malformed email'); return { messages: [{ text: 'Invoice' }], attachments: [] }; },
  makeReceiptFiguresHtml: async (rows, downloadLinks) => { assert.equal(downloadLinks, false); assert.equal(rows[0].receiptDataUrl, original ?? undefined); return '<figure>Invoice</figure>'; },
  makeReceiptArchive: (rows, fy) => { assert.equal(fy, '2025-26'); assert.equal(rows[0].receiptDataUrl, original ?? undefined); return Uint8Array.of(80, 75); },
};
const overrides = {
  'next/server': { NextResponse: { json: (value, options = {}) => Response.json(value, options) } },
  '@/lib/storage-neon': db,
  '@/lib/mobile-auth': { getBearerUserId: async () => { authCalls++; return signedIn ? owner : null; } },
  '@/lib/constants': { FY_DATE_RANGES: { '2025-26': {} } },
  '@/lib/receipt-evidence': evidence,
};
const compiled = ts.transpileModule(readFileSync('src/app/api/mobile/[resource]/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const compiledModule = { exports: {} };
runInThisContext(`(function(require,module,exports){${compiled}\n})`)(name => overrides[name] ?? nativeRequire(name), compiledModule, compiledModule.exports);
const route = compiledModule.exports;
const request = (resource, method = 'GET', body, query = '') => route[method](new Request(`http://fixture.test/api/mobile/${resource}${query}`, {
  method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
}), { params: Promise.resolve({ resource }) });
let scenarios = 0;
const check = async (name, fn) => { calls.length = 0; authCalls = 0; await fn(); scenarios++; console.log(`✓ ${name}`); };

await check('Mobile resources reject unsigned requests before accessing storage', async () => {
  signedIn = false;
  for (const resource of ['data', 'receipt-evidence', 'receipt-pack', 'receipt-archive']) assert.equal((await request(resource)).status, 401);
  assert.equal((await request('expenses', 'PUT', { id })).status, 401);
  assert.equal(calls.length, 0); signedIn = true;
});
await check('Mobile account bundle authenticates once and scopes every read to the owner and selected FY', async () => {
  const response = await request('data'); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(authCalls, 1); assert.equal(calls.length, 8);
  for (const name of ['getExpenses', 'getAssets', 'getWfhEntries', 'getWfhActualCosts', 'getRentalTransactions']) assert.equal(calls.find(c => c[0] === name)[2], '2025-26');
  assert.equal(calls.find(c => c[0] === 'getCgtTransactions').length, 2);
  assert.equal(data.expenses[0].receiptDataUrl, undefined);
});
await check('Bundle read failure returns an error instead of empty financial records', async () => {
  failure = 'getAssets'; assert.equal((await request('data')).status, 500); failure = '';
});
await check('Linked expense and asset are passed to a single storage transaction; failure is surfaced', async () => {
  const asset = { id: '00000000-0000-4000-8000-000000000003', workUsePercent: 50 };
  const expense = { id, workUsePercent: 50, reviewStatus: 'reviewed', linkedAsset: asset };
  assert.equal((await request('expenses', 'PUT', expense)).status, 204);
  assert.deepEqual(calls, [['saveExpense', owner, expense, asset]]);
  failure = 'saveExpense'; assert.equal((await request('expenses', 'PUT', expense)).status, 500); failure = '';
});
await check('Receipt evidence retains its original when email preview parsing fails', async () => {
  parseFailure = true;
  const data = await (await request('receipt-evidence', 'GET', undefined, `?id=${id}`)).json();
  assert.equal(data.dataUrl, original); assert.equal(data.email, null); assert.ok(data.previewError); parseFailure = false;
});
await check('Receipt exports batch only owned receipts and report missing originals', async () => {
  const pack = await (await request('receipt-pack', 'GET', undefined, '?fy=2025-26')).json();
  assert.equal(pack.html, '<figure>Invoice</figure>'); assert.deepEqual(pack.missing, []);
  assert.deepEqual(calls.find(c => c[0] === 'getExpenseReceipts'), ['getExpenseReceipts', owner, [id]]);
  original = null;
  const zip = await (await request('receipt-archive', 'GET', undefined, '?fy=2025-26')).json();
  assert.equal(zip.missing, 1); assert.equal(zip.base64, 'UEs=');
});
await check('Export read failure aborts instead of silently producing a receiptless pack', async () => {
  failure = 'getExpenseReceipts'; assert.equal((await request('receipt-pack', 'GET', undefined, '?fy=2025-26')).status, 500); failure = '';
  assert.equal((await request('receipt-archive', 'GET', undefined, '?fy=unknown')).status, 500);
});
console.log(`${scenarios} mobile API regression scenarios passed.`);
