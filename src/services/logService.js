async function getAllLogs(db, limit = 100) {
  const { rows } = await db.query(
    'SELECT * FROM logs ORDER BY "createdAt" DESC LIMIT $1',
    [limit]
  );
  return rows;
}

async function addLog(db, { clientId, player, guid, type, action, details, severity }) {
  const query = `
    INSERT INTO logs ("clientId", player, guid, type, action, details, severity)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
  const { rows } = await db.query(query, [
    clientId || null,
    player || null,
    guid || null,
    type,
    action || null,
    details || null,
    severity || 'low'
  ]);
  return rows[0].id;
}

module.exports = {
  getAllLogs,
  addLog
};
