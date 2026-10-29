'use strict';
const { methods, ok } = require('../../lib/http');
const session = require('../../lib/session');
const db = require('../../lib/db');
const { publicUser } = require('../../lib/auth');
module.exports = methods({ GET: async (req, res) => {
  const u = await session.current(req);
  if (!u) return ok(res, { user: null });
  const users = await db.q(`SELECT id, display_name, color FROM users WHERE active=1 ORDER BY id`);
  return ok(res, { user: publicUser(u), users, currency: process.env.CURRENCY || 'EUR' });
} });
