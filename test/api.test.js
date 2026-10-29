'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { mockDb, call } = require('./harness');
const cryptoLib = require('../lib/crypto');

process.env.SESSION_SECRET = 'test-secret';
process.env.SETUP_TOKEN = 'setup-xyz';

const asUser = (sql) => /FROM sessions s JOIN users/.test(sql);

test('login: manjkajoči podatki -> 400', async () => {
  mockDb();
  const res = await call(require('../api/auth'), { method: 'POST', body: { action: 'login' } });
  assert.strictEqual(res.statusCode, 400);
});

test('login: pravilno geslo -> 200', async () => {
  mockDb({ one: async () => ({ id: 1, username: 'ana', active: 1, password_hash: cryptoLib.hashPassword('geslo123'), display_name: 'Ana', color: '#4f7fff' }) });
  const res = await call(require('../api/auth'), { method: 'POST', body: { action: 'login', username: 'ana', password: 'geslo123' } });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json.user.display_name, 'Ana');
});

test('auth: neznano dejanje -> 400', async () => {
  mockDb();
  const res = await call(require('../api/auth'), { method: 'POST', body: { action: 'xyz' } });
  assert.strictEqual(res.statusCode, 400);
});

test('import prek transactions: brez vrstic -> napaka', async () => {
  mockDb({ one: async (sql) => asUser(sql) ? { id: 1, active: 1 } : { id: 1 } });
  const res = await call(require('../api/transactions'), { method: 'POST', url: '/api/transactions?action=import', headers: { cookie: 'vo_sess=x' }, body: { account_id: 1, rows: [] } });
  assert.strictEqual(res.statusCode, 400);
});

test('setup: napačen token -> 403', async () => {
  mockDb();
  const res = await call(require('../api/setup'), { method: 'POST', body: { token: 'ne' } });
  assert.strictEqual(res.statusCode, 403);
});

test('accounts: brez prijave -> 401', async () => {
  mockDb({ one: async () => null });
  const res = await call(require('../api/accounts'), { method: 'GET' });
  assert.strictEqual(res.statusCode, 401);
});

test('transactions: negativen znesek -> napaka', async () => {
  mockDb({ one: async (sql) => asUser(sql) ? { id: 1, username: 'ana', active: 1 } : { id: 1 } });
  const res = await call(require('../api/transactions'), { method: 'POST', headers: { cookie: 'vo_sess=x' }, body: { type: 'expense', amount: -5, account_id: 1, tdate: '2026-10-01' } });
  assert.strictEqual(res.statusCode, 400);
});

test('transactions: prenos na isti račun -> napaka', async () => {
  mockDb({ one: async (sql) => asUser(sql) ? { id: 1, active: 1 } : { id: 2 } });
  const res = await call(require('../api/transactions'), { method: 'POST', headers: { cookie: 'vo_sess=x' }, body: { type: 'transfer', amount: 10, account_id: 2, counter_account_id: 2, tdate: '2026-10-01' } });
  assert.strictEqual(res.statusCode, 400);
});

test('transactions: veljaven odhodek -> 200', async () => {
  let inserted = false;
  mockDb({
    one: async (sql) => asUser(sql) ? { id: 1, active: 1, username: 'ana' } : { id: 1 },
    run: async (sql) => { if (/INSERT INTO transactions/.test(sql)) inserted = true; return { insertId: 7 }; },
  });
  const res = await call(require('../api/transactions'), { method: 'POST', headers: { cookie: 'vo_sess=x' }, body: { type: 'expense', amount: '12,50', account_id: 1, tdate: '2026-10-05', note: 'Trgovina' } });
  assert.strictEqual(res.statusCode, 200);
  assert.ok(inserted);
});

test('goals: manjka ciljni znesek -> napaka', async () => {
  mockDb({ one: async (sql) => asUser(sql) ? { id: 1, active: 1 } : null });
  const res = await call(require('../api/goals'), { method: 'POST', headers: { cookie: 'vo_sess=x' }, body: { name: 'Dopust' } });
  assert.strictEqual(res.statusCode, 400);
});
