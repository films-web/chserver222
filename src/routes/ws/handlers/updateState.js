const { logNameChangeHistory } = require('../../../services/clientService');

module.exports = async function handleUpdateState(fastify, socket, currentClientId, payload) {
  if (!currentClientId) return;

  try {
    let { name, playerNum, state, server } = payload.data;
    const redisKey = `player:${currentClientId}`;

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

    if (name && name !== oldName) {
      updates.name = name;
      changed = true;
    }

    if (changed) {
      await fastify.redis.hset(redisKey, updates);
    }

    if (name && name !== oldName) {
      const cleanNameLog = name.replace(/\^./g, '').trim();

      if (cleanNameLog !== "") {
        logNameChangeHistory(
          fastify.db, currentClientId, cleanNameLog, server || oldServer
        ).catch(err => fastify.log.error(`Failed to log name history:`, err));
      }
    }

    socket.sendSuccess('update_state');

  } catch (err) {
    socket.sendError('update_state', 'Internal server error during state update.');
  }
};