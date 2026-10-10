import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { unzipSync } from 'fflate';

const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const compiledModule = { exports: {} }; cache.set(file, compiledModule);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const require = name => name.startsWith('.') ? load(resolve(dirname(file), `${name}.ts`)) : nativeRequire(name);
  runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { readEmailEvidence, makeReceiptPackHtml, makeReceiptFiguresHtml, makeReceiptArchive, receiptBytes } = load('src/lib/receipt-evidence.ts');
const { expenseReviewStatus } = load('src/lib/receipt-review.ts');
const pdf = Buffer.from('%PDF-1.4\nSynthetic original invoice\n');
const original = `From: seller@example.test\r\nSubject: Chair invoice\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="invoice"\r\n\r\n--invoice\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nChair AUD 600.00\r\n--invoice\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="chair.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdf.toString('base64')}\r\n--invoice--\r\n`;
const bundle = `From: evidence@example.test\r\nSubject: Receipt review context\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="bundle"\r\n\r\n--bundle\r\nContent-Type: text/plain\r\n\r\nPending review\r\n--bundle\r\nContent-Type: message/rfc822\r\nContent-Disposition: attachment; filename="original.eml"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(original).toString('base64')}\r\n--bundle--\r\n`;
const url = 'data:message/rfc822;base64,' + Buffer.from(bundle).toString('base64');
const email = await readEmailEvidence(url);
assert.equal(email.messages.length, 2);
const genericEmail = await readEmailEvidence('data:message/rfc822;base64,' + Buffer.from(bundle.replace('Content-Type: message/rfc822', 'Content-Type: application/octet-stream')).toString('base64'));
assert.equal(genericEmail.messages.length, 2, 'Mail.app generic .eml attachments must also be readable');
assert.ok(genericEmail.messages.some(m => m.text.includes('Chair AUD 600.00')));
assert.ok(email.messages.some(m => m.text.includes('Chair AUD 600.00')));
assert.deepEqual(Buffer.from(receiptBytes(email.attachments.find(a => a.name === 'chair.pdf').dataUrl)), pdf);
const e = { id: 'test-id', date: '2026-06-01', description: '<script>bad()</script> "Chair"', amount: 600,
  category: 'office_furniture', claimType: 'full', workUsePercent: 0, claimableAmount: 0,
  notes: 'AI scan: Pending your review', financialYear: '2025-26', receiptDataUrl: url };
const missing = { ...e, id: 'missing', description: 'Evidence flagged but absent', hasReceipt: true, receiptDataUrl: undefined };
const html = await makeReceiptPackHtml([e, missing], '2025-26', 'blob:archive');
assert.ok(html.includes('Chair AUD 600.00'));
assert.ok(html.includes('1 originals included · 1 entries without stored evidence'));
assert.ok(html.includes('Download all original receipts (ZIP)'));
assert.ok(!html.includes('<img src="data:message/rfc822'));
assert.ok(!html.includes('<script>bad()'));
assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
const printed = await makeReceiptFiguresHtml([e], false);
assert.ok(printed.includes('Chair AUD 600.00'));
assert.ok(printed.includes('Original attachment: chair.pdf'));
assert.ok(!printed.includes('href=') && !printed.includes('data:'));
assert.ok(!printed.includes('<script>bad()'));
const files = unzipSync(makeReceiptArchive([e, missing], '2025-26'));
assert.deepEqual(Buffer.from(files['receipts/2026-06-01-test-id.eml']), Buffer.from(bundle));
const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
assert.equal(manifest.entries.find(e => e.id === 'missing').evidenceStatus, 'missing');
assert.equal(expenseReviewStatus(e), 'pending');
assert.equal(expenseReviewStatus({ ...e, reviewStatus: 'personal' }), 'personal');
assert.equal(expenseReviewStatus({ ...e, reviewStatus: null }), 'pending');
assert.equal(expenseReviewStatus({ ...e, workUsePercent: 50, reviewStatus: 'reviewed' }), 'reviewed');
const htmlEmail = 'data:message/rfc822;base64,' + Buffer.from('From: seller@example.test\r\nSubject: HTML invoice\r\nContent-Type: text/html\r\n\r\n<script>attack()</script><p>AUD &amp; 80</p><img src="https://tracker.example.test/pixel">').toString('base64');
const safe = await readEmailEvidence(htmlEmail);
assert.equal(safe.messages[0].text, 'AUD & 80');
assert.ok(!safe.messages[0].text.includes('attack'));
console.log('Receipt evidence checks passed: nested emails, PDF attachments, safe previews, original ZIP bytes, missing evidence and review decisions.');
