const bcrypt = require('bcrypt');

async function getUserByUsername(db, username) {
  const { rows } = await db.query('SELECT * FROM "users" WHERE username = $1', [username]);
  return rows[0];
}

async function createAdminUser(db, username, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10);
  const { rows } = await db.query(
    'INSERT INTO "users" (username, "password") VALUES ($1, $2) RETURNING id',
    [username, hash]
  );
  return rows[0].id;
}

async function verifyPassword(plainPassword, hash) {
  return await bcrypt.compare(plainPassword, hash);
}

module.exports = { getUserByUsername, createAdminUser, verifyPassword };