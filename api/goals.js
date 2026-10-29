'use strict';
// Varčevalni cilji + prispevki.
//   GET · POST (nov) · PUT ?id · DELETE ?id
//   POST ?id&action=contribute { amount, cdate, note } · GET ?id&contributions=1
const { methods, readBody, query, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

function num(v) { const n = Number(String(v).replace(',', '.')); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }

module.exports = methods({
  GET: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const q = query(req);
    if (q.id && q.contributions) {
      const rows = await db.q(`SELECT * FROM goal_contributions WHERE goal_id=:id ORDER BY cdate DESC, id DESC`, { id: +q.id });
      return ok(res, { contributions: rows.map(r => ({ ...r, amount: Number(r.amount) })) });
    }
    const rows = await db.q(
      `SELECT g.*, COALESCE((SELECT SUM(amount) FROM goal_contributions WHERE goal_id=g.id),0) AS saved
       FROM goals g WHERE g.archived=0 ORDER BY g.created_at`);
    return ok(res, { goals: rows.map(g => ({ ...g, target_amount: Number(g.target_amount), saved: Number(g.saved) })) });
  },

  POST: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const q = query(req);
    if (q.action === 'contribute') {
      const id = +q.id; const b = await readBody(req);
      const g = await db.one(`SELECT id FROM goals WHERE id=:id`, { id }); if (!g) return bad(res, 'Cilj ne obstaja', 404);
      const amount = num(b.amount);
      if (isNaN(amount) || amount === 0) return bad(res, 'Vnesite znesek');
      const cdate = /^\d{4}-\d{2}-\d{2}$/.test(b.cdate || '') ? b.cdate : new Date().toISOString().slice(0, 10);
      await db.run(`INSERT INTO goal_contributions (goal_id, amount, cdate, note) VALUES (:g,:a,:d,:n)`,
        { g: id, a: amount, d: cdate, n: (b.note || '').slice(0, 190) });
      return ok(res, { ok: true });
    }
    const b = await readBody(req);
    if (!String(b.name || '').trim()) return bad(res, 'Vnesite ime cilja');
    const target = num(b.target_amount);
    if (isNaN(target) || target <= 0) return bad(res, 'Vnesite ciljni znesek');
    const r = await db.run(
      `INSERT INTO goals (name, target_amount, account_id, color, due_date) VALUES (:n,:t,:a,:c,:d)`,
      { n: b.name.trim(), t: target, a: b.account_id ? +b.account_id : null, c: b.color || '#2fae6b',
        d: /^\d{4}-\d{2}-\d{2}$/.test(b.due_date || '') ? b.due_date : null });
    return ok(res, { id: r.insertId });
  },

  PUT: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const id = +query(req).id; const b = await readBody(req);
    const g = await db.one(`SELECT * FROM goals WHERE id=:id`, { id }); if (!g) return bad(res, 'Ne obstaja', 404);
    await db.run(`UPDATE goals SET name=:n, target_amount=:t, color=:c, due_date=:d, archived=:ar WHERE id=:id`,
      { n: b.name ?? g.name, t: b.target_amount !== undefined ? num(b.target_amount) : g.target_amount,
        c: b.color ?? g.color, d: b.due_date !== undefined ? (b.due_date || null) : g.due_date, ar: b.archived ? 1 : 0, id });
    return ok(res, { ok: true });
  },

  DELETE: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    await db.run(`DELETE FROM goals WHERE id=:id`, { id: +query(req).id });
    return ok(res, { ok: true });
  },
});
