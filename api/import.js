'use strict';
// Uvoz transakcij iz CSV (razčlenjeno na odjemalcu).  POST { account_id, rows:[{tdate,amount,type,note,category_id?,person_user_id?}] }
const { methods, readBody, ok, bad } = require('../lib/http');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

function num(v) { const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }

module.exports = methods({
  POST: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const b = await readBody(req);
    const accountId = +b.account_id;
    if (!accountId || !(await db.one(`SELECT id FROM accounts WHERE id=:id`, { id: accountId }))) return bad(res, 'Izberite veljaven račun');
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!rows.length) return bad(res, 'Ni vrstic za uvoz');
    let inserted = 0, skipped = 0;
    for (const r of rows.slice(0, 2000)) {
      const amount = num(r.amount);
      const type = r.type === 'income' ? 'income' : 'expense';
      if (isNaN(amount) || amount === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(r.tdate || '')) { skipped++; continue; }
      await db.run(
        `INSERT INTO transactions (type, amount, account_id, category_id, person_user_id, tdate, note, created_by)
         VALUES (:ty,:am,:acc,:cat,:per,:d,:n,:by)`,
        { ty: type, am: Math.abs(amount), acc: accountId, cat: r.category_id ? +r.category_id : null,
          per: r.person_user_id ? +r.person_user_id : null, d: r.tdate, n: (r.note || '').slice(0, 190), by: u.id });
      inserted++;
    }
    return ok(res, { inserted, skipped });
  },
});
