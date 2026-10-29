'use strict';
// Povzetki za nadzorno ploščo.  GET ?month=YYYY-MM
const { methods, query, ok } = require('../lib/http');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { BAL } = require('./accounts');

module.exports = methods({
  GET: async (req, res) => {
    const u = await requireAuth(req, res); if (!u) return;
    const month = /^\d{4}-\d{2}$/.test(query(req).month || '') ? query(req).month : new Date().toISOString().slice(0, 7);

    // skupno stanje po računih
    const accs = await db.q(`SELECT a.id, a.name, a.kind, a.color, (${BAL}) AS balance FROM accounts a WHERE a.archived=0 ORDER BY a.sort, a.id`);
    const totalBalance = accs.reduce((s, a) => s + Number(a.balance), 0);
    const savings = accs.filter(a => a.kind === 'savings').reduce((s, a) => s + Number(a.balance), 0);

    // mesec: prihodki/odhodki (brez prenosov)
    const m = await db.one(
      `SELECT COALESCE(SUM(type='income')*0,0) x,
         COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) expense
       FROM transactions WHERE DATE_FORMAT(tdate,'%Y-%m')=:m`, { m: month });
    const income = Number(m.income), expense = Number(m.expense);

    // po kategorijah (odhodki) za mesec
    const byCat = await db.q(
      `SELECT c.id, c.name, c.color, c.icon, SUM(t.amount) AS total
       FROM transactions t JOIN categories c ON c.id=t.category_id
       WHERE t.type='expense' AND DATE_FORMAT(t.tdate,'%Y-%m')=:m
       GROUP BY c.id ORDER BY total DESC`, { m: month });

    // po osebah (odhodki) za mesec
    const byPerson = await db.q(
      `SELECT usr.id, usr.display_name, usr.color, SUM(t.amount) AS total
       FROM transactions t JOIN users usr ON usr.id=t.person_user_id
       WHERE t.type='expense' AND DATE_FORMAT(t.tdate,'%Y-%m')=:m GROUP BY usr.id ORDER BY total DESC`, { m: month });

    // zadnjih 6 mesecev
    const series = await db.q(
      `SELECT DATE_FORMAT(tdate,'%Y-%m') ym,
         SUM(CASE WHEN type='income' THEN amount END) income,
         SUM(CASE WHEN type='expense' THEN amount END) expense
       FROM transactions WHERE tdate >= DATE_SUB(DATE_FORMAT(NOW(),'%Y-%m-01'), INTERVAL 5 MONTH)
       GROUP BY ym ORDER BY ym`);

    return ok(res, {
      month, totalBalance, savings,
      accounts: accs.map(a => ({ ...a, balance: Number(a.balance) })),
      income, expense, net: income - expense,
      byCategory: byCat.map(r => ({ ...r, total: Number(r.total) })),
      byPerson: byPerson.map(r => ({ ...r, total: Number(r.total) })),
      series: series.map(r => ({ ym: r.ym, income: Number(r.income || 0), expense: Number(r.expense || 0) })),
    });
  },
});
