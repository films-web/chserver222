const { logNameChangeHistory } = require('../../../services/clientService');

module.exports = async function handleUpdateState(fastify, connection, currentClientId, payload) {
  if (!currentClientId) return;

  try {
    const { state, server, name, playerNum } = payload.data;
    const redisKey = `player:${currentClientId}`;

    const [oldName, oldServer, oldState, oldPlayerNum] = await fastify.redis.hmget(
      redisKey, 'name', 'server', 'state', 'playerNum'
    );

    let changed = false;
    const updates = {};

    if (state !== undefined && String(oldState) !== String(state)) {
      updates.state = String(state);
      changed = true;
    }

    if (server !== undefined && server !== oldServer) {
      updates.server = server;
      changed = true;
    }

    if (playerNum !== undefined && String(playerNum) !== String(oldPlayerNum)) {
      updates.playerNum = playerNum;
      changed = true;
    }

    if (name && name !== oldName) {
      updates.name = name;
      changed = true;
    }

    if (changed) {
      await fastify.redis.hset(redisKey, updates);
    }

    if (name && name !== oldName) {
      logNameChangeHistory(
        fastify.db, currentClientId, name, server || oldServer
      ).catch(err => fastify.log.error(`Failed to log name history for ${currentClientId}:`, err));
    }
    
    connection.sendSuccess('update_state');

  } catch (err) {
    connection.sendError('update_state', 'Internal server error processing state update.');
  }
};