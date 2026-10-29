'use strict';
// Ponavljajoče postavke (mesečno).  GET · POST · PUT ?id · DELETE ?id · POST ?action=run (materializiraj zapadle)
const { methods, readBody, query, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { materializeDue } = require('../lib/recurring');

function num(v) { const n = Number(String(v).replace(',', '.')); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }

module.exports = methods({
  GET: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const rows = await db.q(
      `SELECT r.*, c.name category_name, a.name account_name, ca.name counter_name, usr.display_name person_name
       FROM recurring r LEFT JOIN categories c ON c.id=r.category_id
       LEFT JOIN accounts a ON a.id=r.account_id LEFT JOIN accounts ca ON ca.id=r.counter_account_id
       LEFT JOIN users usr ON usr.id=r.person_user_id ORDER BY r.active DESC, r.day_of_month`);
    return ok(res, { recurring: rows.map(r => ({ ...r, amount: Number(r.amount) })) });
  },
  POST: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    if (query(req).action === 'run') { const n = await materializeDue(); return ok(res, { created: n }); }
    const b = await readBody(req);
    const type = ['income', 'expense', 'transfer'].includes(b.type) ? b.type : null;
    const amount = num(b.amount);
    if (!type || isNaN(amount) || amount <= 0 || !+b.account_id) return bad(res, 'Preverite tip, znesek in račun');
    const r = await db.run(
      `INSERT INTO recurring (type, amount, account_id, counter_account_id, category_id, person_user_id, day_of_month, note, active)
       VALUES (:ty,:am,:acc,:cacc,:cat,:per,:dom,:n,1)`,
      { ty: type, am: amount, acc: +b.account_id, cacc: b.counter_account_id ? +b.counter_account_id : null,
        cat: b.category_id ? +b.category_id : null, per: b.person_user_id ? +b.person_user_id : null,
        dom: Math.min(28, Math.max(1, +b.day_of_month || 1)), n: (b.note || '').slice(0, 190) });
    return ok(res, { id: r.insertId });
  },
  PUT: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const id = +query(req).id; const b = await readBody(req);
    const r = await db.one(`SELECT * FROM recurring WHERE id=:id`, { id }); if (!r) return bad(res, 'Ne obstaja', 404);
    await db.run(
      `UPDATE recurring SET type=:ty, amount=:am, account_id=:acc, counter_account_id=:cacc, category_id=:cat,
          person_user_id=:per, day_of_month=:dom, note=:n, active=:a WHERE id=:id`,
      { ty: b.type ?? r.type, am: b.amount !== undefined ? num(b.amount) : r.amount, acc: b.account_id ?? r.account_id,
        cacc: b.counter_account_id ?? r.counter_account_id, cat: b.category_id ?? r.category_id, per: b.person_user_id ?? r.person_user_id,
        dom: b.day_of_month ? Math.min(28, Math.max(1, +b.day_of_month)) : r.day_of_month, n: b.note ?? r.note,
        a: b.active === undefined ? r.active : (b.active ? 1 : 0), id });
    return ok(res, { ok: true });
  },
  DELETE: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    await db.run(`DELETE FROM recurring WHERE id=:id`, { id: +query(req).id });
    return ok(res, { ok: true });
  },
});
