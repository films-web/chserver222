const fs = require('fs');
const path = require('path');

async function getActiveLoader(db) {
  const { rows } = await db.query(
    `SELECT id, url, "fileName", version, "clientSecret", "fileSize" 
     FROM "Loader" WHERE "isActive" = true ORDER BY "updatedAt" DESC LIMIT 1`
  );
  return rows.length > 0 ? rows[0] : null;
}

async function addLoader(db, data) {
  const { url, fileName, version, clientSecret, fileSize = null, isActive = true } = data;
  if (isActive) await db.query('UPDATE "Loader" SET "isActive" = false');

  const { rows } = await db.query(
    `INSERT INTO "Loader" (url, "fileName", version, "clientSecret", "fileSize", "isActive", "updatedAt", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
    [url, fileName, version, clientSecret, fileSize, isActive]
  );
  return rows[0].id;
}

async function removeLoader(db, loaderId) {
  const { rows } = await db.query('SELECT "fileName" FROM "Loader" WHERE id = $1', [loaderId]);

  const { rowCount } = await db.query('DELETE FROM "Loader" WHERE id = $1', [loaderId]);

  if (rowCount > 0 && rows.length > 0 && rows[0].fileName) {
    const filePath = path.join(__dirname, '../../uploads/loaders', rows[0].fileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        // we log the error but return true because the DB record is gone
        console.error(`Failed to delete loader file: ${err.message}`);
      }
    }
  }

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

async function updateLoader(db, id, data) {
  const { url, fileName, version, clientSecret, fileSize = null } = data;
  const { rowCount } = await db.query(
    `UPDATE "Loader" SET url = $1, "fileName" = $2, version = $3, "clientSecret" = $4, "fileSize" = $5, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $6`,
    [url, fileName, version, clientSecret, fileSize, id]
  );
  return rowCount > 0;
}

async function getLoaderByVersion(db, version) {
  const { rows } = await db.query(
    'SELECT "clientSecret" FROM "Loader" WHERE version = $1 LIMIT 1',
    [version]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = { getActiveLoader, addLoader, removeLoader, setActiveLoader, updateLoader, getLoaderByVersion };
