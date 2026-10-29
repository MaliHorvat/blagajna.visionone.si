'use strict';
// Kategorije.  GET · POST · PUT ?id · DELETE ?id
const { methods, readBody, query, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

module.exports = methods({
  GET: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const rows = await db.q(`SELECT * FROM categories ORDER BY type, sort, name`);
    return ok(res, { categories: rows });
  },
  POST: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const b = await readBody(req);
    if (!String(b.name || '').trim()) return bad(res, 'Vnesite ime');
    const type = b.type === 'income' ? 'income' : 'expense';
    const r = await db.run(`INSERT INTO categories (name,type,color,icon,sort) VALUES (:n,:t,:c,:i,:s)`,
      { n: b.name.trim(), t: type, c: b.color || '#8a94a6', i: (b.icon || '').slice(0, 8), s: +b.sort || 99 });
    return ok(res, { id: r.insertId });
  },
  PUT: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const id = +query(req).id; const b = await readBody(req);
    const c = await db.one(`SELECT * FROM categories WHERE id=:id`, { id }); if (!c) return bad(res, 'Ne obstaja', 404);
    await db.run(`UPDATE categories SET name=:n, color=:c, icon=:i, sort=:s WHERE id=:id`,
      { n: b.name ?? c.name, c: b.color ?? c.color, i: b.icon !== undefined ? String(b.icon).slice(0, 8) : c.icon, s: b.sort ?? c.sort, id });
    return ok(res, { ok: true });
  },
  DELETE: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const id = +query(req).id;
    await db.run(`UPDATE transactions SET category_id=NULL WHERE category_id=:id`, { id });
    await db.run(`DELETE FROM categories WHERE id=:id`, { id });
    return ok(res, { ok: true });
  },
});
