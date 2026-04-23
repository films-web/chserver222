const { randomBytes } = require('crypto');

async function loginOrRegisterClient(db, hwid, signature) {
  const { rows } = await db.query('SELECT id, guid FROM clients WHERE hwid = $1', [hwid]);

  if (rows.length > 0) {
    const clientId = rows[0].id;
    const clientGuid = rows[0].guid;
    await db.query(
      `UPDATE clients SET "signature" = $1, "lastSeen" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
      [signature, clientId]
    );
    return { clientId, clientGuid };
  } else {
    const clientGuid = randomBytes(3).toString('hex');
    const insertResult = await db.query(
      `INSERT INTO clients (hwid, guid, signature, "updatedAt") 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id`,
      [hwid, clientGuid, signature]
    );
    return { clientId: insertResult.rows[0].id, clientGuid };
  }
}

async function logNameChangeHistory(db, clientId, newName, server) {
  const { rows } = await db.query(
    `SELECT name FROM names_history WHERE "clientId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [clientId]
  );

  if (rows.length > 0 && rows[0].name === newName) {
    return; 
  }

  await db.query(
    `INSERT INTO names_history ("clientId", "name", "server") VALUES ($1, $2, $3)`,
    [clientId, newName, server || null]
  );

  await db.query(
    `UPDATE clients SET "currentName" = $1 WHERE id = $2`,
    [newName, clientId]
  );
}

module.exports = { 
  loginOrRegisterClient, 
  logNameChangeHistory 
};