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

async function updateWhitelist(db, id, name, hash) {
  const { rowCount } = await db.query(
    'UPDATE whitelists SET name = $1, hash = $2 WHERE id = $3',
    [name, hash, id]
  );
  return rowCount > 0;
}

module.exports = { getAllWhitelistedHashes, addtoWhitelist, removeFromWhitelist, updateWhitelist };