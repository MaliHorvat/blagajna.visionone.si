'use strict';
const { methods, readBody, ok, bad } = require('../../lib/http');
const db = require('../../lib/db');
const crypto = require('../../lib/crypto');
const session = require('../../lib/session');
const { requireAuth } = require('../../lib/auth');
module.exports = methods({ POST: async (req, res) => {
  const u = await requireAuth(req, res); if (!u) return;
  const b = await readBody(req);
  if (!crypto.verifyPassword(String(b.current||''), u.password_hash)) return bad(res, 'Trenutno geslo ni pravilno', 401);
  if (String(b.next||'').length < 6) return bad(res, 'Novo geslo mora imeti vsaj 6 znakov');
  await db.run(`UPDATE users SET password_hash=:p WHERE id=:id`, { p: crypto.hashPassword(b.next), id: u.id });
  await session.destroyAllForUser(u.id); await session.create(res, u.id, req);
  return ok(res, { ok: true });
} });
