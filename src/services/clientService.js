const { randomBytes } = require('crypto');


async function loginOrRegisterClient(db, hwid, signature) {
  const { rows } = await db.query('SELECT id, guid, "currentName" FROM clients WHERE hwid = $1', [hwid]);

  if (rows.length > 0) {
    const { id: clientId, guid: clientGuid, currentName } = rows[0];
    await db.query(
      `UPDATE clients 
       SET "signature" = $1, "lastSeen" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [signature, clientId]
    );
    return { clientId, clientGuid, currentName: currentName || 'UnnamedPlayer' };
  } else {
    const clientGuid = randomBytes(3).toString('hex');
    const defaultName = 'UnnamedPlayer';
    const insertResult = await db.query(
      `INSERT INTO clients (hwid, guid, signature, "currentName", "updatedAt") 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id`,
      [hwid, clientGuid, signature, defaultName]
    );
    return { clientId: insertResult.rows[0].id, clientGuid, currentName: defaultName };
  }
}

async function logNameChangeHistory(db, clientId, newName, server) {
  await db.query(
    `UPDATE clients SET "currentName" = $1 WHERE id = $2`,
    [newName, clientId]
  );

  await db.query(
    `INSERT INTO names_history ("clientId", "name", "server")
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM names_history WHERE "clientId" = $1 AND name = $2
     )`,
    [clientId, newName, server || null]
  );
}

async function logEvent(db, clientId, message) {
  await db.query(
    'INSERT INTO logs ("clientId", "message") VALUES ($1, $2)',
    [clientId, message]
  );
}

module.exports = { 
  loginOrRegisterClient, 
  logNameChangeHistory,
  logEvent
};