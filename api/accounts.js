'use strict';
// Računi (+ izračunano stanje).  GET · POST · PUT ?id · DELETE ?id
const { methods, readBody, query, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

const KINDS = ['shared', 'personal', 'savings', 'cash'];

const BAL = `a.opening_balance
  + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id=a.id AND type='income'),0)
  - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id=a.id AND type='expense'),0)
  - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id=a.id AND type='transfer'),0)
  + COALESCE((SELECT SUM(amount) FROM transactions WHERE counter_account_id=a.id AND type='transfer'),0)`;

module.exports = methods({
  GET: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const incArch = query(req).all === '1';
    const rows = await db.q(
      `SELECT a.*, (${BAL}) AS balance, usr.display_name AS owner_name
       FROM accounts a LEFT JOIN users usr ON usr.id=a.owner_user_id
       ${incArch ? '' : 'WHERE a.archived=0'} ORDER BY a.sort, a.id`);
    return ok(res, { accounts: rows.map(r => ({ ...r, balance: Number(r.balance), opening_balance: Number(r.opening_balance) })) });
  },

  POST: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    if (!name) return bad(res, 'Vnesite ime računa');
    const kind = KINDS.includes(b.kind) ? b.kind : 'shared';
    const r = await db.run(
      `INSERT INTO accounts (name, kind, owner_user_id, color, opening_balance, sort)
       VALUES (:n,:k,:o,:c,:ob,:s)`,
      { n: name, k: kind, o: b.owner_user_id || null, c: b.color || '#4f7fff',
        ob: num(b.opening_balance), s: +b.sort || 0 });
    return ok(res, { id: r.insertId });
  },

  PUT: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const id = +query(req).id; const b = await readBody(req);
    const a = await db.one(`SELECT * FROM accounts WHERE id=:id`, { id }); if (!a) return bad(res, 'Račun ne obstaja', 404);
    await db.run(
      `UPDATE accounts SET name=:n, kind=:k, owner_user_id=:o, color=:c, opening_balance=:ob, archived=:ar, sort=:s WHERE id=:id`,
      { n: b.name ?? a.name, k: KINDS.includes(b.kind) ? b.kind : a.kind, o: b.owner_user_id ?? a.owner_user_id,
        c: b.color ?? a.color, ob: b.opening_balance !== undefined ? num(b.opening_balance) : a.opening_balance,
        ar: b.archived ? 1 : 0, s: b.sort ?? a.sort, id });
    return ok(res, { ok: true });
  },

  DELETE: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const id = +query(req).id;
    const n = await db.one(`SELECT COUNT(*) AS c FROM transactions WHERE account_id=:id OR counter_account_id=:id`, { id });
    if (n && Number(n.c) > 0) return bad(res, 'Račun ima transakcije – ga arhivirajte namesto brisanja.');
    await db.run(`DELETE FROM accounts WHERE id=:id`, { id });
    return ok(res, { ok: true });
  },
});
function num(v) { const n = Number(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }
module.exports.BAL = BAL;
