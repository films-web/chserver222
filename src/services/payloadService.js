async function getActivePayload(db) {
  const { rows } = await db.query(
    `SELECT id, url, "fileHash", "fileName", version 
     FROM "Payload" WHERE "isActive" = true ORDER BY "updatedAt" DESC LIMIT 1`
  );
  return rows.length > 0 ? rows[0] : null;
}

async function addPayload(db, data) {
  const { url, fileHash, fileName, version, isActive = true } = data;
  if (isActive) await db.query('UPDATE "Payload" SET "isActive" = false');

  const { rows } = await db.query(
    `INSERT INTO "Payload" (url, "fileHash", "fileName", version, "isActive", "updatedAt", "createdAt")
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
    [url, fileHash, fileName, version, isActive]
  );
  return rows[0].id;
}

async function removePayload(db, payloadId) {
  const { rowCount } = await db.query('DELETE FROM "Payload" WHERE id = $1', [payloadId]);
  return rowCount > 0;
}

async function setActivePayload(db, payloadId) {
  await db.query('UPDATE "Payload" SET "isActive" = false');
  const { rowCount } = await db.query(
    `UPDATE "Payload" SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
    [payloadId]
  );
  return rowCount > 0;
}

async function updatePayload(db, id, data) {
  const { url, fileHash, fileName, version } = data;
  const { rowCount } = await db.query(
    `UPDATE "Payload" SET url = $1, "fileHash" = $2, "fileName" = $3, version = $4, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $5`,
    [url, fileHash, fileName, version, id]
  );
  return rowCount > 0;
}

module.exports = { getActivePayload, addPayload, removePayload, setActivePayload, updatePayload };