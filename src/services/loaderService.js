async function getActiveLoader(db) {
  const { rows } = await db.query(
    `SELECT id, url, "fileName", version, "clientSecret" 
     FROM "Loader" WHERE "isActive" = true ORDER BY "updatedAt" DESC LIMIT 1`
  );
  return rows.length > 0 ? rows[0] : null;
}

async function addLoader(db, data) {
  const { url, fileName, version, clientSecret, isActive = true } = data;
  if (isActive) await db.query('UPDATE "Loader" SET "isActive" = false');

  const { rows } = await db.query(
    `INSERT INTO "Loader" (url, "fileName", version, "clientSecret", "isActive", "updatedAt", "createdAt")
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
    [url, fileName, version, clientSecret, isActive]
  );
  return rows[0].id;
}

async function removeLoader(db, loaderId) {
  const { rowCount } = await db.query('DELETE FROM "Loader" WHERE id = $1', [loaderId]);
  return rowCount > 0;
}

async function setActiveLoader(db, loaderId) {
  await db.query('UPDATE "Loader" SET "isActive" = false');
  const { rowCount } = await db.query(
    `UPDATE "Loader" SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
    [loaderId]
  );
  return rowCount > 0;
}

module.exports = { getActiveLoader, addLoader, removeLoader, setActiveLoader };
