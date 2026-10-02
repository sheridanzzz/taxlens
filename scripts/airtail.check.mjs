import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

// Production crypto, import conversion and SQL run with disposable state.
// This check never loads environment files or touches an external account.
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const compiledModule = { exports: {} }; cache.set(file, compiledModule);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const require = name => name.startsWith('.') ? load(resolve(dirname(file), `${name}.ts`)) : nativeRequire(name);
  runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const security = load('src/lib/airtail-security.ts');
const imports = load('src/lib/airtail-import.ts');
const validation = load('src/lib/validation.ts');
process.env.AIRTAIL_CONNECTOR_SECRET = 'fixture-connection-encryption-secret-only';
let count = 0;
const check = async (name, fn) => { await fn(); count++; console.log(`✓ ${name}`); };
await check('Connection secrets are encrypted and bound to their owner and purpose', () => {
  const value = 'airtail_fixture_secret';
  const encrypted = security.seal(value, 'token:owner');
  assert.equal(security.unseal(encrypted, 'token:owner'), value);
  assert.notEqual(security.seal(value, 'token:owner'), encrypted);
  assert.throws(() => security.unseal(encrypted, 'token:someone-else'));
  assert.throws(() => security.unseal(encrypted, 'flow'));
  const tampered = Buffer.from(encrypted, 'base64url'); tampered[20] ^= 1;
  assert.throws(() => security.unseal(tampered.toString('base64url'), 'token:owner'));
});
await check('The callback requires matching state, owner, and an unexpired flow', () => {
  const now = 1_000_000;
  const flow = { userId: 'owner', state: security.randomSecret(), verifier: security.randomSecret(), createdAt: now };
  security.validateFlow(flow, 'owner', flow.state, now + 599_999);
  assert.throws(() => security.validateFlow(flow, 'someone-else', flow.state, now));
  assert.throws(() => security.validateFlow(flow, 'owner', 'wrong', now));
  assert.throws(() => security.validateFlow(flow, 'owner', flow.state, now + 600_001));
  assert.throws(() => security.appOrigin('http://remote.test'));
  assert.throws(() => security.appOrigin('https://user:pass@remote.test'));
  assert.equal(security.appOrigin('http://localhost:3118'), 'http://localhost:3118');
});
const receipt = { id: '100000000000000000000001', vendor: 'Shop', amount: 49, currency: 'AUD', date: '2025-06-30', subject: 'Receipt', provider: 'gmail' };
const evidence = { subject: 'Receipt', from: 'shop@example.test', date: '2025-06-30T12:00:00Z', text: 'Original receipt body', attachments: [], originalEmail: 'data:message/rfc822;base64,U3ViamVjdDogUmVjZWlwdA0KDQpGaXh0dXJl' };
const prepared = imports.prepareAirtailImport(receipt, evidence);
await check('Repeated imports have stable IDs; foreign currency requires an explicit AUD amount', () => {
  assert.equal(imports.prepareAirtailImport(receipt, evidence).id, prepared.id);
  assert.notEqual(imports.airtailExpenseId('100000000000000000000002'), prepared.id);
  assert.equal(prepared.receiptDataUrl, evidence.originalEmail);
  assert.match(prepared.notes, /Original amount: 49 AUD/);
  assert.throws(() => imports.prepareAirtailImport({ ...receipt, currency: 'USD' }, evidence));
  assert.equal(imports.prepareAirtailImport({ ...receipt, currency: 'USD' }, evidence, 75.42).amount, 75.42);
  assert.throws(() => imports.prepareAirtailImport(receipt, { ...evidence, originalEmail: 'https://untrusted.test' }));
});
const expense = { ...prepared, category: 'software_subscriptions', claimType: 'full', workUsePercent: 0, claimableAmount: 0, financialYear: '2024-25', createdAt: '2025-06-30T12:00:00Z' };
await check('An imported receipt preserves its original email and starts with no deduction', () => {
  const validated = validation.validateExpense(expense);
  assert.equal(validated.claimableAmount, 0);
  assert.equal(validated.receiptDataUrl, evidence.originalEmail);
});
const db = new PGlite(); await db.waitReady;
const migration = file => readFileSync(`supabase/migrations/${file}`, 'utf8');
await db.exec(migration('001_initial_schema.sql').split('alter table public.expenses enable row level security;')[0].replaceAll('references auth.users(id) on delete cascade', ''));
await db.exec(migration('002_help_debt_and_mls.sql'));
await db.exec(migration('003_cgt_transactions.sql'));
await db.exec(migration('004_rental_properties.sql'));
await db.exec(migration('005_linked_claims.sql'));
await check('Migration 006 is repeatable and original MIME emails survive atomic claim saves', async () => {
  await db.exec(migration('006_airtail_connector.sql'));
  await db.exec(migration('006_airtail_connector.sql'));
  const owner = '00000000-0000-0000-0000-000000000001';
  await db.query('select ledger_save_expense($1::uuid,$2::jsonb,null)', [owner, JSON.stringify(expense)]);
  const { rows } = await db.query('select receipt_data_url,claimable_amount from expenses where id=$1 and user_id=$2', [expense.id, owner]);
  assert.equal(rows[0].receipt_data_url, evidence.originalEmail);
  assert.equal(Number(rows[0].claimable_amount), 0);
  const definitions = await db.query("select pg_get_functiondef(oid) as definition from pg_proc where proname='ledger_save_expense'");
  assert.equal(definitions.rows[0].definition.match(/\|message\/rfc822/g).length, 1);
  const ciphertext = security.seal('fixture-token', `token:${owner}`);
  await db.query('insert into airtail_connections(user_id,token_ciphertext,account_email,expires_at) values($1,$2,$3,$4)', [owner, ciphertext, 'fixture@example.test', '2026-12-31']);
  const other = await db.query('select * from airtail_connections where user_id=$1', ['00000000-0000-0000-0000-000000000002']);
  assert.equal(other.rows.length, 0);
});
await check('Supabase policies prevent another account reading or changing connector credentials', async () => {
  await db.exec(`create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
    create role authenticated;
    grant usage on schema public,auth to authenticated;`);
  await db.exec(migration('006_airtail_connector.sql'));
  await db.exec("set role authenticated; set test.user_id='00000000-0000-0000-0000-000000000002';");
  assert.equal((await db.query('select * from airtail_connections')).rows.length, 0);
  await assert.rejects(db.query("insert into airtail_connections(user_id,token_ciphertext,account_email,expires_at) values('00000000-0000-0000-0000-000000000001','fake','attacker@example.test',now())"), /row.level security/i);
  await db.exec("set test.user_id='00000000-0000-0000-0000-000000000001';");
  assert.equal((await db.query('select * from airtail_connections')).rows.length, 1);
  await assert.rejects(db.query("update airtail_connections set user_id='00000000-0000-0000-0000-000000000002'"), /row.level security/i);
  await db.exec('reset role;');
});
await db.close();
console.log(`${count} Ledgr Airtail checks passed`);
