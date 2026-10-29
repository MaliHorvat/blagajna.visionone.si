'use strict';
const session = require('./session');
const { bad } = require('./http');

// Vrne prijavljenega uporabnika ali pošlje 401.
async function requireAuth(req, res) {
  const u = await session.current(req);
  if (!u) { bad(res, 'Prijava je potrebna', 401); return null; }
  return u;
}
function publicUser(u) {
  return { id: u.id, username: u.username, display_name: u.display_name, color: u.color };
}
module.exports = { requireAuth, publicUser };
