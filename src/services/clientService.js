const { randomBytes } = require('crypto');


async function loginOrRegisterClient(db, hwid, signature, currentName = 'UnnamedPlayer') {
  const { rows } = await db.query('SELECT id, guid FROM clients WHERE hwid = $1', [hwid]);

  if (rows.length > 0) {
    const clientId = rows[0].id;
    const clientGuid = rows[0].guid;
    await db.query(
      `UPDATE clients 
       SET "signature" = $1, "currentName" = $2, "lastSeen" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [signature, currentName, clientId]
    );
    return { clientId, clientGuid };
  } else {
    const clientGuid = randomBytes(3).toString('hex');
    const insertResult = await db.query(
      `INSERT INTO clients (hwid, guid, signature, "currentName", "updatedAt") 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id`,
      [hwid, clientGuid, signature, currentName]
    );
    return { clientId: insertResult.rows[0].id, clientGuid };
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