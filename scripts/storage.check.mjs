import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

// Execute the production storage modules against real, disposable PostgreSQL.
// No environment files, network, credentials or external databases are used.
process.on("uncaughtException", error => { console.error(error.message); process.exitCode = 1; });
const db = new PGlite();
await db.waitReady;
const sql = async (strings, ...values) => (await db.query(
  strings.reduce((s, part, i) => s + part + (i < values.length ? `$${i + 1}` : ''), ''), values)).rows;
sql.query = async (query, values) => (await db.query(query, values)).rows;
const nativeRequire = createRequire(import.meta.url);
let backend = 'local';
let supabaseFailure = new Error('Injected cloud failure');
const failedQuery = new Proxy({}, { get: (_, prop) => prop === 'then'
  ? (resolve) => resolve({ data: null, error: supabaseFailure }) : () => failedQuery });
const supabaseClient = { from: () => failedQuery, rpc: () => failedQuery,
  auth: { getUser: async () => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001' } }, error: null }) } };
const neonActions = { __esModule: true };
const overrides = {
  '@/lib/neon': { sql: () => sql },
  '@/lib/supabase/client': { createClient: () => supabaseClient },
  './env': { isSupabaseConfigured: () => backend === 'supabase', isNeonConfigured: () => backend === 'neon' },
  './storage-actions': neonActions,
};
const cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const compiledModule = { exports: {} }; cache.set(file, compiledModule);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const require = (name) => name in overrides ? overrides[name] : name.startsWith('.')
    ? load(resolve(dirname(file), `${name}.ts`)) : nativeRequire(name);
  runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const local = load('src/lib/storage-local.ts');
const storage = load('src/lib/storage.ts');
const neon = load('src/lib/storage-neon.ts');
const values = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
const user = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const id = n => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const pdf = 'data:application/pdf;base64,JVBERi0xLjQK';
const asset = { id: id(1), name: 'Laptop', assetType: 'laptop', purchaseDate: '2025-08-01',
  purchasePrice: 1500, effectiveLifeYears: 4, depreciationMethod: 'diminishing', workUsePercent: 100,
  financialYear: '2025-26', createdAt: '2025-08-01T00:00:00Z' };
const expense = { id: id(2), description: 'Laptop', date: asset.purchaseDate, amount: 1500,
  category: 'computer_equipment', claimType: 'depreciation', assetId: asset.id, workUsePercent: 100,
  claimableAmount: 0, financialYear: '2025-26', receiptDataUrl: pdf, createdAt: asset.createdAt };
let scenarios = 0;
const check = async (name, fn) => { await fn(); scenarios++; console.log(`✓ ${name}`); };

await check('Local paired saves, personal swipe, undo and receipt preservation', async () => {
  local.saveExpense(expense, asset);
  local.saveExpense({ ...expense, receiptDataUrl: undefined, hasReceipt: true, workUsePercent: 0 });
  assert.equal(local.getAssets()[0].workUsePercent, 0);
  assert.equal(local.getExpenses()[0].receiptDataUrl, pdf);
  local.saveExpense({ ...expense, receiptDataUrl: undefined, hasReceipt: true });
  assert.equal(local.getAssets()[0].workUsePercent, 100);
  local.saveAsset({ ...asset, purchasePrice: 1800 });
  assert.equal(local.getExpenses()[0].amount, 1800);
});
await check('Local storage failures roll back both records and retry without duplicates', async () => {
  const before = JSON.stringify([...values]);
  const original = localStorage.setItem;
  let fail = true;
  localStorage.setItem = (key, value) => {
    if (key === 'taxlens_assets' && fail) { fail = false; throw new Error('Quota exceeded'); }
    original(key, value);
  };
  assert.throws(() => local.saveExpense({ ...expense, amount: 1900 }, { ...asset, purchasePrice: 1900 }), /Quota/);
  assert.equal(JSON.stringify([...values]), before);
  localStorage.setItem = original;
  local.saveExpense({ ...expense, amount: 1900 }, { ...asset, purchasePrice: 1900 });
  assert.equal(local.getExpenses().length, 1);
  assert.equal(local.getAssets().length, 1);
});
await check('Local legacy linking, asset edit/delete and full-claim conversion stay consistent', async () => {
  values.clear(); localStorage.setItem('taxlens_expenses', JSON.stringify([{ ...expense, assetId: undefined }]));
  localStorage.setItem('taxlens_assets', JSON.stringify([asset]));
  local.saveAsset({ ...asset, purchasePrice: 1800 });
  assert.equal(local.getExpenses()[0].amount, 1800);
  assert.equal(local.getExpenses()[0].assetId, asset.id);
  local.saveExpense({ ...local.getExpenses()[0], claimType: 'full' });
  assert.equal(local.getAssets().length, 0);
  local.saveExpense(expense, asset); local.deleteAsset(asset.id);
  assert.equal(local.getExpenses()[0].workUsePercent, 0);
  assert.equal(local.getExpenses()[0].receiptDataUrl, pdf);
  local.saveExpense(expense, asset); local.deleteExpense(expense.id);
  assert.equal(local.getAssets().length, 0);
});
await check('Malformed backups leave existing data unchanged; PDF backup round trips', async () => {
  local.saveExpense(expense, asset);
  const backup = local.exportAllData();
  const before = JSON.stringify([...values]);
  assert.equal(local.importAllData(JSON.stringify({ expenses: [], assets: {} })), false);
  assert.equal(local.importAllData('{}'), false);
  assert.equal(JSON.stringify([...values]), before);
  local.clearAllData(); assert.equal(local.importAllData(backup), true);
  assert.equal(local.getExpenses()[0].receiptDataUrl, pdf);
});

const migration = file => readFileSync(`supabase/migrations/${file}`, 'utf8');
const base = migration('001_initial_schema.sql');
await db.exec(base.split('alter table public.expenses enable row level security;')[0]
  .replaceAll('references auth.users(id) on delete cascade', ''));
await db.exec(migration('002_help_debt_and_mls.sql'));
await db.exec(migration('003_cgt_transactions.sql'));
await db.exec(migration('004_rental_properties.sql'));
await check('Unsaved local and cloud profiles do not invent an occupation', async () => {
  const saved = values.get('taxlens_settings');
  values.delete('taxlens_settings');
  assert.equal(local.getSettings().occupation, '');
  assert.equal((await neon.getSettings(user)).occupation, '');
  localStorage.setItem('taxlens_settings', JSON.stringify({ occupation: 'Teacher' }));
  assert.equal(local.getSettings().occupation, 'Teacher');
  if (saved === undefined) values.delete('taxlens_settings');
  else values.set('taxlens_settings', saved);
});
await check('Migration links unambiguous legacy evidence and leaves ambiguous records untouched', async () => {
  for (const n of [30,31,32]) {
    await sql`insert into assets(id,user_id,name,asset_type,purchase_date,purchase_price,effective_life_years,depreciation_method,work_use_percent,financial_year)
      values(${id(n)},${user},${n===30 ? 'Unique legacy laptop' : 'Ambiguous laptop'},'laptop','2025-08-01',1500,4,'diminishing',100,'2025-26')`;
  }
  for (const n of [33,34]) {
    await sql`insert into expenses(id,user_id,date,description,amount,category,claim_type,work_use_percent,claimable_amount,financial_year)
      values(${id(n)},${user},'2025-08-01',${n===33 ? 'Unique legacy laptop' : 'Ambiguous laptop'},1500,'computer_equipment','depreciation',100,0,'2025-26')`;
  }
  await db.exec(migration('005_linked_claims.sql'));
  assert.equal((await sql`select asset_id from expenses where id=${id(33)}`)[0].asset_id, id(30));
  assert.equal((await sql`select asset_id from expenses where id=${id(34)}`)[0].asset_id, null);
  await db.exec(migration('005_linked_claims.sql'));
  await sql`delete from expenses where id in (${id(33)},${id(34)})`;
  await sql`delete from assets where id in (${id(30)},${id(31)},${id(32)})`;
});
await check('PostgreSQL paired save, edit, personal swipe and undo preserve the original PDF', async () => {
  await neon.saveExpense(user, expense, asset);
  await neon.saveExpense(user, { ...expense, hasReceipt: true, receiptDataUrl: undefined, workUsePercent: 0 });
  assert.equal((await neon.getAssets(user))[0].workUsePercent, 0);
  assert.equal(await neon.getExpenseReceipt(user, expense.id), pdf);
  await neon.saveExpense(user, { ...expense, receiptDataUrl: undefined, hasReceipt: true });
  await neon.saveAsset(user, { ...asset, purchasePrice: 1800 });
  assert.equal((await neon.getExpenses(user))[0].amount, 1800);
});
await check('Cloud list timestamps remain sortable strings with multiple records on one date', async () => {
  const full = { ...expense, id:id(6), description:'Course', claimType:'full', assetId:undefined };
  await neon.saveExpense(user,full);
  const rows = await neon.getExpenses(user);
  assert.equal(rows.length,2);
  assert.ok(rows.every(e => typeof e.createdAt === 'string'));
  await neon.deleteExpense(user,full.id);
});
await check('PostgreSQL refuses cross-account edits/deletes without changing either record', async () => {
  await assert.rejects(neon.saveExpense(other, expense, asset), /Not authorized/);
  await assert.rejects(neon.saveAsset(other, asset), /Not authorized/);
  await assert.rejects(neon.deleteExpense(other, expense.id), /Not authorized/);
  await assert.rejects(neon.deleteAsset(other, asset.id), /Not authorized/);
  assert.equal((await neon.getExpenses(user))[0].amount, 1800);
  assert.equal((await neon.getAssets(user))[0].purchasePrice, 1800);
});
await check('A failed PostgreSQL evidence insert rolls back its preceding asset update', async () => {
  await assert.rejects(neon.saveExpense(user, { ...expense, id: id(3), amount: 1900 }, { ...asset, purchasePrice: 1900 }), /unique/);
  assert.equal((await neon.getAssets(user))[0].purchasePrice, 1800);
  assert.equal((await neon.getExpenses(user)).length, 1);
  await assert.rejects(sql`SELECT ledger_save_expense(${user}::uuid, ${JSON.stringify({ ...expense, workUsePercent: -1 })}::jsonb)`, /Invalid expense/);
});
await check('PostgreSQL full-claim conversion and deletion do not leave duplicate deductions', async () => {
  await neon.saveExpense(user, { ...expense, claimType: 'full' });
  assert.equal((await neon.getAssets(user)).length, 0);
  await neon.saveExpense(user, expense, asset); await neon.deleteAsset(user, asset.id);
  assert.equal((await neon.getExpenses(user))[0].workUsePercent, 0);
  assert.equal(await neon.getExpenseReceipt(user, expense.id), pdf);
  await neon.saveExpense(user, expense, asset); await neon.deleteExpense(user, expense.id);
  assert.equal((await neon.getAssets(user)).length, 0);
});
await check('All remaining Neon upserts reject IDs owned by another account', async () => {
  const fixtures = [
    ['saveWfhEntry', { id: id(10), date: '2025-08-01', hours: 8, financialYear: '2025-26' }],
    ['saveWfhActualCost', { id: id(11), category: 'Electricity', annualCost: 900, workUsePercent: 0, financialYear: '2025-26' }],
    ['saveCgtTransaction', { id: id(12), kind: 'crypto', asset: 'BTC', side: 'buy', date: '2025-08-01', quantity: 0.0001, unitPrice: 100000, fee: 1, createdAt: asset.createdAt }],
    ['saveRentalProperty', { id: id(13), address: '1 Example Street', ownershipPercent: 50, createdAt: asset.createdAt }],
    ['saveRentalTransaction', { id: id(14), propertyId: id(13), date: '2025-08-01', kind: 'income', category: 'rent', description: 'Rent', amount: 1000, deductiblePercent: 100, financialYear: '2025-26', createdAt: asset.createdAt }],
  ];
  for (const [method, value] of fixtures) { await neon[method](user, value); await assert.rejects(neon[method](other, value)); }
  await assert.rejects(neon.saveRentalTransaction(other, { ...fixtures.at(-1)[1], id: id(15) }), /foreign key/);
});
await check('Supabase functions respect the authenticated user and RLS protects trades', async () => {
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create role authenticated; grant usage on schema public,auth to authenticated;
    grant all on all tables in schema public to authenticated; grant execute on all functions in schema public,auth to authenticated;`);
  await db.exec(base.slice(base.indexOf('alter table public.expenses enable row level security;')));
  await db.exec(migration('004_rental_properties.sql'));
  await db.exec(migration('005_linked_claims.sql'));
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${user}'`);
  await neon.saveExpense(user, expense, asset);
  await assert.rejects(neon.saveExpense(other, { ...expense, id: id(20) }, asset), /Not authorized/);
  await neon.saveAsset(user, { ...asset, id: id(22) });
  await db.exec(`set request.jwt.claim.sub='${other}'`);
  assert.equal((await db.query('select * from cgt_transactions')).rows.length, 0);
  await assert.rejects(neon.saveAsset(other, asset));
  assert.equal((await db.query('select * from expenses')).rows.length, 0);
  await assert.rejects(sql`insert into expenses(id,user_id,date,description,amount,category,claim_type,work_use_percent,claimable_amount,financial_year,asset_id)
    values(${id(21)},${other},'2025-08-01','Foreign asset',1500,'computer_equipment','depreciation',100,0,'2025-26',${id(22)})`, /foreign key/);
  await db.exec('reset role');
});
await check('Every Supabase read, mutation and delete propagates storage failures', async () => {
  backend = 'supabase';
  const operations = [
    () => storage.getExpenses(), () => storage.getAssets(), () => storage.getWfhEntries(),
    () => storage.getWfhActualCosts(), () => storage.getCgtTransactions(), () => storage.getRentalProperties(),
    () => storage.getRentalTransactions(), () => storage.getSettings(), () => storage.getExpenseReceipt(expense.id),
    () => storage.saveExpense(expense, asset), () => storage.saveAsset(asset),
    () => storage.saveWfhEntry({ id: id(10), date: '2025-08-01', hours: 8, financialYear: '2025-26' }),
    () => storage.deleteExpense(expense.id), () => storage.deleteAsset(asset.id), () => storage.deleteWfhEntry(id(10)),
    () => storage.deleteWfhActualCost(id(11)), () => storage.deleteCgtTransaction(id(12)),
    () => storage.deleteRentalProperty(id(13)), () => storage.deleteRentalTransaction(id(14)),
    () => storage.saveSettings(local.getSettings()), () => storage.clearAllData(),
  ];
  for (const operation of operations) await assert.rejects(operation(), /Injected cloud failure/);
});
await check('Cloud backups hydrate receipts omitted from list queries', async () => {
  backend = 'neon';
  Object.assign(neonActions, {
    neonGetExpenses: async () => [{ ...expense, receiptDataUrl: undefined, hasReceipt: true }],
    neonGetExpenseReceipt: async () => pdf, neonGetAssets: async () => [asset], neonGetWfhEntries: async () => [],
    neonGetWfhActualCosts: async () => [], neonGetCgtTransactions: async () => [], neonGetRentalProperties: async () => [],
    neonGetRentalTransactions: async () => [], neonGetSettings: async () => local.getSettings(),
  });
  assert.equal(JSON.parse(await storage.exportAllData()).expenses[0].receiptDataUrl, pdf);
});
await check('Clear-all removes settings and records only for the caller', async () => {
  await db.exec(`set request.jwt.claim.sub='${user}'`);
  await neon.saveSettings(user, { ...local.getSettings(), annualIncome: 120000 });
  await neon.clearAllData(user);
  for (const table of ['expenses','assets','wfh_entries','wfh_actual_costs','cgt_transactions','rental_properties','rental_transactions','user_settings'])
    assert.equal((await db.query(`select count(*)::int n from ${table} where user_id=$1`,[user])).rows[0].n,0);
  await db.exec(`set request.jwt.claim.sub='${other}'`);
  await neon.saveWfhEntry(other,{id:id(90), date:'2025-08-01', hours:8, financialYear:'2025-26'});
  await db.exec(`set request.jwt.claim.sub='${user}'`);
  await assert.rejects(neon.clearAllData(other), /Not authorized/);
  assert.equal((await db.query('select count(*)::int n from wfh_entries where user_id=$1',[other])).rows[0].n,1);
});
await db.close();
console.log(`${scenarios} storage regression scenarios passed.`);
