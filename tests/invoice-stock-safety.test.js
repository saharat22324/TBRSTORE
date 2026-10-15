const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/supabaseService.js'), 'utf8');
const start = source.indexOf('function invoiceReferenceId(');
const end = source.indexOf('async function getInvoicePayments(', start);
const stockId = '00000000-0000-4000-8000-000000000001';

function service() {
  const calls = [];
  const context = vm.createContext({
    console: { log() {} },
    reportSupabaseWriteError() {},
    getSupabase: () => ({ rpc: async (name, payload) => {
      calls.push({ name, payload });
      return { data: { id: stockId }, error: null };
    } })
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, calls };
}

const stockLine = { type: 'stock', stockItemId: stockId, quantity: 1.5, unitPrice: 10, total: 15 };

test('valid stock references and fractional quantities reach the atomic RPC', async () => {
  const { context, calls } = service();
  await context.addInvoice(stockId, null, null, [stockLine], 15, 0, 0, 15, '', 'TEST');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.p_invoice.job_id, stockId);
  assert.equal(calls[0].payload.p_items[0].stock_item_id, stockId);
  assert.equal(calls[0].payload.p_items[0].quantity, 1.5);
});

test('invalid job references are not silently detached', async () => {
  const { context, calls } = service();
  await assert.rejects(context.addInvoice('JOB-LOCAL', null, null, [stockLine], 15, 0, 0, 15, '', 'TEST'), /Job is invalid/);
  assert.equal(calls.length, 0);
});

test('create and edit reject missing or invalid stock references before RPC', async () => {
  for (const stockItemId of [null, '', 'OIL-DEX6']) {
    const { context, calls } = service();
    const items = [{ ...stockLine, stockItemId }];
    await assert.rejects(context.addInvoice(null, null, null, items, 15, 0, 0, 15, '', 'TEST'), /Stock item/);
    await assert.rejects(context.updateInvoiceFull(stockId, {}, items), /Stock item/);
    assert.equal(calls.length, 0);
  }
});

test('non-stock lines need no stock reference, but invalid quantities are rejected', () => {
  const { context } = service();
  assert.equal(context.invoiceAtomicItems([{ type: 'service', quantity: 1 }])[0].stock_item_id, null);
  for (const quantity of [0, -1, null, 'invalid', Infinity]) {
    assert.throws(() => context.invoiceAtomicItems([{ ...stockLine, quantity }]), /quantity/);
  }
});

test('create forwards retry identity and edit forwards the loaded version', async () => {
  const { context, calls } = service();
  await context.addInvoice(null, null, null, [stockLine], 15, 0, 0, 15, '', 'TEST', { requestId: stockId });
  await context.updateInvoiceFull(stockId, { version: 7 }, [stockLine]);
  assert.equal(calls[0].payload.p_invoice.request_id, stockId);
  assert.equal(calls[1].payload.p_invoice.expected_version, 7);
});

test('billing error messages handle reconciliation and stale versions', () => {
  const billing = fs.readFileSync(path.join(__dirname, '../js/billing.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(billing.slice(billing.indexOf('function invoiceWriteErrorMessage('), billing.indexOf('async function saveInvoice(')), context);
  for (const message of ['STOCK_RECONCILIATION_REQUIRED', 'Invoice version changed', 'Invoice request payload changed']) {
    assert.ok(context.invoiceWriteErrorMessage({ message }).length > 0);
  }
});