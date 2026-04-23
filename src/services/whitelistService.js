async function getAllWhitelistedHashes(db) {
  const { rows } = await db.query('SELECT hash FROM whitelists');
  return rows.map(row => row.hash);
}

async function addtoWhitelist(db, name, hash) {
  const { rows } = await db.query(
    'INSERT INTO whitelists (name, hash) VALUES ($1, $2) RETURNING id',
    [name, hash]
  );
  return rows[0].id;
}

async function removeFromWhitelist(db, hash) {
  const { rowCount } = await db.query('DELETE FROM whitelists WHERE hash = $1', [hash]);
  return rowCount > 0;
}

module.exports = { getAllWhitelistedHashes, addtoWhitelist, removeFromWhitelist };