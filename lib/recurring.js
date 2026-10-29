'use strict';
// Materializacija ponavljajočih postavk: ustvari transakcijo za tekoči mesec, ko je dan dosežen.
const db = require('./db');

async function materializeDue() {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  const today = now.getDate();
  const due = await db.q(
    `SELECT * FROM recurring WHERE active=1 AND day_of_month<=:d AND (last_run IS NULL OR last_run<>:ym)`,
    { d: today, ym });
  let created = 0;
  for (const r of due) {
    const tdate = `${ym}-${String(r.day_of_month).padStart(2, '0')}`;
    await db.run(
      `INSERT INTO transactions (type, amount, account_id, counter_account_id, category_id, person_user_id, tdate, note, recurring_id)
       VALUES (:ty,:am,:acc,:cacc,:cat,:per,:d,:n,:rid)`,
      { ty: r.type, am: r.amount, acc: r.account_id, cacc: r.counter_account_id, cat: r.category_id,
        per: r.person_user_id, d: tdate, n: r.note || 'Ponavljajoča postavka', rid: r.id });
    await db.run(`UPDATE recurring SET last_run=:ym WHERE id=:id`, { ym, id: r.id });
    created++;
  }
  return created;
}

module.exports = { materializeDue };
