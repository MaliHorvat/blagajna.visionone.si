'use strict';
// Dnevni cron: materializira zapadle ponavljajoče postavke.
const { methods, ok, bad } = require('../../lib/http');
const { materializeDue } = require('../../lib/recurring');
function allowed(req){ const s=process.env.CRON_SECRET; if(!s) return true; return (req.headers['authorization']||'')===`Bearer ${s}`; }
async function handle(req,res){ if(!allowed(req)) return bad(res,'Ni dovoljeno',401); const n=await materializeDue(); return ok(res,{created:n}); }
module.exports = methods({ GET: handle, POST: handle });
