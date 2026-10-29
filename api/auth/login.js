'use strict';
// POST /api/auth/login { username, password }
const { methods, readBody, ok, bad } = require('../../lib/http');
const db = require('../../lib/db');
const crypto = require('../../lib/crypto');
const session = require('../../lib/session');
const { publicUser } = require('../../lib/auth');

module.exports = methods({
  POST: async (req, res) => {
    const b = await readBody(req);
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!username || !password) return bad(res, 'Vnesite uporabniško ime in geslo');
    const u = await db.one(`SELECT * FROM users WHERE username=:u`, { u: username });
    const okPass = u ? crypto.verifyPassword(password, u.password_hash) : crypto.verifyPassword(password, crypto.hashPassword('x'));
    if (!u || !u.active || !okPass) return bad(res, 'Napačno uporabniško ime ali geslo', 401);
    await db.run(`UPDATE users SET last_login=NOW() WHERE id=:id`, { id: u.id });
    await session.create(res, u.id, req);
    return ok(res, { user: publicUser(u) });
  },
});
