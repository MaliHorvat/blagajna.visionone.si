'use strict';
// Enkratni zagon: ustvari tabele + dve osebi + privzete račune. Zaščiteno s SETUP_TOKEN.
// POST { token, users:[{username,display_name,password,color}], accountName? }
const { methods, readBody, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const { migrate } = require('../lib/schema');
const crypto = require('../lib/crypto');

module.exports = methods({
  POST: async (req, res) => {
    const b = await readBody(req);
    if (!process.env.SETUP_TOKEN) return bad(res, 'SETUP_TOKEN ni nastavljen na strežniku', 500);
    if (b.token !== process.env.SETUP_TOKEN) return bad(res, 'Napačen SETUP_TOKEN', 403);

    await migrate();
    const existing = await db.one(`SELECT COUNT(*) AS n FROM users`);
    if (existing && Number(existing.n) > 0) return ok(res, { migrated: true, created: false, note: 'Uporabniki že obstajajo.' });

    const users = Array.isArray(b.users) && b.users.length ? b.users : [];
    if (users.length < 1) return bad(res, 'Vnesite vsaj enega uporabnika');
    const colors = ['#4f7fff', '#e0623a'];
    let i = 0;
    for (const u of users.slice(0, 2)) {
      const username = String(u.username || '').trim().toLowerCase();
      const pw = String(u.password || '');
      if (!/^[a-z0-9._-]{2,40}$/.test(username)) return bad(res, 'Neveljavno uporabniško ime: ' + username);
      if (pw.length < 6) return bad(res, 'Geslo mora imeti vsaj 6 znakov (' + username + ')');
      await db.run(`INSERT INTO users (username, display_name, password_hash, color) VALUES (:u,:d,:p,:c)`,
        { u: username, d: u.display_name || username, p: crypto.hashPassword(pw), c: u.color || colors[i] || '#4f7fff' });
      i++;
    }
    // privzeti skupni račun
    const accName = b.accountName || 'Skupni račun';
    await db.run(`INSERT INTO accounts (name, kind, color, sort) VALUES (:n,'shared','#4f7fff',0)`, { n: accName });

    return ok(res, { migrated: true, created: true, users: users.length });
  },
});
