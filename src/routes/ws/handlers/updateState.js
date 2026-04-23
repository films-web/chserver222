const { logNameChangeHistory } = require('../../../services/clientService');

module.exports = async function handleUpdateState(fastify, connection, currentClientId, payload) {
  if (!currentClientId) return;

  const { state, currentServer, currentName, currentPlayerNum } = payload.data;
  const redisKey = `player:${currentClientId}`;

  const [oldName, oldServer, oldState, oldPlayerNum] = await fastify.redis.hmget(
    redisKey,
    'name',
    'server',
    'state',
    'playerNum'
  );

  let changed = false;
  const updates = {};

  if (oldState && oldState !== state) {
    updates.state = state;
    changed = true;
  }

  if (currentServer !== oldServer) {
    updates.server = currentServer;
    changed = true;
  }

  if (currentPlayerNum && currentPlayerNum !== oldPlayerNum) {
    updates.playerNum = currentPlayerNum;
    changed = true;
  }

  if (currentName && currentName !== oldName) {
    updates.name = currentName;
    changed = true;
  }

  if (changed) {
    await fastify.redis.hset(redisKey, updates);
  }

  if (currentName && currentName !== oldName) {
    logNameChangeHistory(
      fastify.db,
      currentClientId,
      currentName,
      currentServer || oldServer
    ).catch(err => {
      fastify.log.error('Failed to log name history:', err);
    });
  }
  
  connection.socket.send(JSON.stringify({ status: 'state_updated' }));
};