async function getAllGuids(db) {
  const { rows } = await db.query('SELECT * FROM custom_guids ORDER BY "createdAt" DESC');
  return rows;
}

async function addCustomGuid(db, originalGuid, customGuid) {
  const { rows } = await db.query(
    `INSERT INTO custom_guids (original_guid, custom_guid) 
     VALUES ($1, $2) 
     ON CONFLICT (original_guid) DO UPDATE SET custom_guid = $2 
     RETURNING id`,
    [originalGuid, customGuid]
  );
  return rows[0].id;
}

async function removeCustomGuid(db, originalGuid) {
  const { rowCount } = await db.query('DELETE FROM custom_guids WHERE original_guid = $1', [originalGuid]);
  return rowCount > 0;
}

async function getSpoofedGuid(db, originalGuid) {
  const { rows } = await db.query('SELECT custom_guid FROM custom_guids WHERE original_guid = $1', [originalGuid]);
  return rows.length > 0 ? rows[0].custom_guid : null;
}

async function updateCustomGuid(db, id, originalGuid, customGuid) {
  const { rowCount } = await db.query(
    'UPDATE custom_guids SET original_guid = $1, custom_guid = $2 WHERE id = $3',
    [originalGuid, customGuid, id]
  );
  return rowCount > 0;
}

module.exports = { getAllGuids, addCustomGuid, removeCustomGuid, getSpoofedGuid, updateCustomGuid };