'use strict';
// Transakcije (prihodki, odhodki, prenosi).  GET (filtri) · POST · PUT ?id · DELETE ?id
const { methods, readBody, query, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

function num(v) { const n = Number(String(v).replace(',', '.')); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }
function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

module.exports = methods({
  GET: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const q = query(req);
    let where = '1=1', p = {};
    if (q.month) { where += ' AND DATE_FORMAT(t.tdate,"%Y-%m")=:m'; p.m = q.month; }
    if (q.from) { where += ' AND t.tdate>=:from'; p.from = q.from; }
    if (q.to) { where += ' AND t.tdate<=:to'; p.to = q.to; }
    if (q.account) { where += ' AND (t.account_id=:acc OR t.counter_account_id=:acc)'; p.acc = +q.account; }
    if (q.type) { where += ' AND t.type=:ty'; p.ty = q.type; }
    if (q.category) { where += ' AND t.category_id=:cat'; p.cat = +q.category; }
    if (q.person) { where += ' AND t.person_user_id=:per'; p.per = +q.person; }
    if (q.search) { where += ' AND t.note LIKE :s'; p.s = '%' + q.search + '%'; }
    const limit = Math.min(1000, Math.max(1, +q.limit || 200));
    const rows = await db.q(
      `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color, c.type AS category_type,
              a.name AS account_name, ca.name AS counter_name, usr.display_name AS person_name
       FROM transactions t
       LEFT JOIN categories c ON c.id=t.category_id
       LEFT JOIN accounts a ON a.id=t.account_id
       LEFT JOIN accounts ca ON ca.id=t.counter_account_id
       LEFT JOIN users usr ON usr.id=t.person_user_id
       WHERE ${where} ORDER BY t.tdate DESC, t.id DESC LIMIT ${limit}`, p);
    return ok(res, { transactions: rows.map(cast) });
  },

  POST: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const b = await readBody(req);
    const v = await validate(b);
    if (v.error) return bad(res, v.error);
    const r = await db.run(
      `INSERT INTO transactions (type, amount, account_id, counter_account_id, category_id, person_user_id, tdate, note, created_by)
       VALUES (:ty,:am,:acc,:cacc,:cat,:per,:d,:n,:by)`,
      { ty: v.type, am: v.amount, acc: v.account_id, cacc: v.counter_account_id, cat: v.category_id,
        per: v.person_user_id, d: v.tdate, n: v.note, by: u.id });
    return ok(res, { id: r.insertId });
  },

  PUT: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const id = +query(req).id; const b = await readBody(req);
    const t = await db.one(`SELECT * FROM transactions WHERE id=:id`, { id }); if (!t) return bad(res, 'Ne obstaja', 404);
    const v = await validate({ ...t, ...b, tdate: b.tdate || t.tdate });
    if (v.error) return bad(res, v.error);
    await db.run(
      `UPDATE transactions SET type=:ty, amount=:am, account_id=:acc, counter_account_id=:cacc, category_id=:cat,
          person_user_id=:per, tdate=:d, note=:n WHERE id=:id`,
      { ty: v.type, am: v.amount, acc: v.account_id, cacc: v.counter_account_id, cat: v.category_id,
        per: v.person_user_id, d: v.tdate, n: v.note, id });
    return ok(res, { ok: true });
  },

  DELETE: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    await db.run(`DELETE FROM transactions WHERE id=:id`, { id: +query(req).id });
    return ok(res, { ok: true });
  },
});

async function validate(b) {
  const type = ['income', 'expense', 'transfer'].includes(b.type) ? b.type : null;
  if (!type) return { error: 'Neveljaven tip' };
  const amount = num(b.amount);
  if (isNaN(amount) || amount <= 0) return { error: 'Znesek mora biti večji od 0' };
  const account_id = +b.account_id;
  if (!account_id || !(await db.one(`SELECT id FROM accounts WHERE id=:id`, { id: account_id }))) return { error: 'Izberite račun' };
  let counter_account_id = null;
  if (type === 'transfer') {
    counter_account_id = +b.counter_account_id;
    if (!counter_account_id || counter_account_id === account_id) return { error: 'Za prenos izberite drug ciljni račun' };
    if (!(await db.one(`SELECT id FROM accounts WHERE id=:id`, { id: counter_account_id }))) return { error: 'Ciljni račun ne obstaja' };
  }
  if (!validDate(b.tdate)) return { error: 'Neveljaven datum' };
  return {
    type, amount, account_id, counter_account_id,
    category_id: type === 'transfer' ? null : (b.category_id ? +b.category_id : null),
    person_user_id: b.person_user_id ? +b.person_user_id : null,
    tdate: b.tdate, note: (b.note || '').slice(0, 190),
  };
}
function cast(t) { return { ...t, amount: Number(t.amount) }; }
