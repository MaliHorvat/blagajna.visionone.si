'use strict';
// Avtentikacija v eni funkciji (Hobby plan: omejeno število funkcij).
//   GET  /api/auth                      -> trenutni uporabnik
//   POST /api/auth {action:'login', username, password}
//   POST /api/auth {action:'logout'}
//   POST /api/auth {action:'password', current, next}
const { methods, readBody, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const crypto = require('../lib/crypto');
const session = require('../lib/session');
const { requireAuth, publicUser } = require('../lib/auth');

module.exports = methods({
  GET: async (req, res) => {
    const u = await session.current(req);
    if (!u) return ok(res, { user: null });
    const users = await db.q(`SELECT id, display_name, color FROM users WHERE active=1 ORDER BY id`);
    return ok(res, { user: publicUser(u), users, currency: process.env.CURRENCY || 'EUR' });
  },

  POST: async (req, res) => {
    const b = await readBody(req);
    const action = b.action;

    if (action === 'login') {
      const username = String(b.username || '').trim().toLowerCase();
      const password = String(b.password || '');
      if (!username || !password) return bad(res, 'Vnesite uporabniško ime in geslo');
      const u = await db.one(`SELECT * FROM users WHERE username=:u`, { u: username });
      const okPass = u ? crypto.verifyPassword(password, u.password_hash) : crypto.verifyPassword(password, crypto.hashPassword('x'));
      if (!u || !u.active || !okPass) return bad(res, 'Napačno uporabniško ime ali geslo', 401);
      await db.run(`UPDATE users SET last_login=NOW() WHERE id=:id`, { id: u.id });
      await session.create(res, u.id, req);
      return ok(res, { user: publicUser(u) });
    }

    if (action === 'logout') {
      await session.destroy(req, res);
      return ok(res, { ok: true });
    }

    if (action === 'password') {
      const u = await requireAuth(req, res); if (!u) return;
      if (!crypto.verifyPassword(String(b.current || ''), u.password_hash)) return bad(res, 'Trenutno geslo ni pravilno', 401);
      if (String(b.next || '').length < 6) return bad(res, 'Novo geslo mora imeti vsaj 6 znakov');
      await db.run(`UPDATE users SET password_hash=:p WHERE id=:id`, { p: crypto.hashPassword(b.next), id: u.id });
      await session.destroyAllForUser(u.id);
      await session.create(res, u.id, req);
      return ok(res, { ok: true });
    }

    return bad(res, 'Neznano dejanje');
  },
});
