const { logNameChangeHistory } = require('../../../services/clientService');

module.exports = async function handleUpdateState(fastify, connection, currentClientId, payload) {
  if (!currentClientId) return;

  try {
    let { state, server, name, playerNum } = payload.data;
    const redisKey = `player:${currentClientId}`;

    const coloredName = name; 
    const cleanName = name ? name.replace(/\^./g, '') : name;

    const [oldName, oldServer, oldState, oldPlayerNum] = await fastify.redis.hmget(
      redisKey, 'name', 'server', 'state', 'playerNum'
    );

    let changed = false;
    const updates = {};

    if (state !== undefined && parseInt(oldState, 10) !== parseInt(state, 10)) {
      updates.state = parseInt(state, 10);
      changed = true;
    }

    if (server !== undefined && server !== oldServer) {
      updates.server = server;
      changed = true;
    }

    if (playerNum !== undefined && parseInt(oldPlayerNum, 10) !== parseInt(playerNum, 10)) {
      updates.playerNum = parseInt(playerNum, 10);
      changed = true;
    }

    if (cleanName) {
      updates.name = cleanName;
      updates.displayName = coloredName; 
      if (cleanName !== oldName) changed = true;
    }

    if (changed) {
      await fastify.redis.hset(redisKey, updates);
    }

    if (cleanName && cleanName !== oldName) {
      logNameChangeHistory(
        fastify.db, currentClientId, cleanName, server || oldServer
      ).catch(err => fastify.log.error(`Failed to log name history:`, err));
    }
    
    connection.sendSuccess('update_state');

  } catch (err) {
    connection.sendError('update_state', 'Internal server error during state update.');
  }
};