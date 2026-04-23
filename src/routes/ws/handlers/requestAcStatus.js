const { getOnlinePlayers } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestAcStatus(fastify, connection, currentClientId) {
  if (!currentClientId) {
    return;
  }

  try {
    const requestingPlayer = await fastify.redis.hgetall(`player:${currentClientId}`);
    
    if (!requestingPlayer || !requestingPlayer.server || requestingPlayer.server === 'In Lobby') {
      return;
    }

    const targetServer = requestingPlayer.server;
    const onlinePlayersInServer = await getOnlinePlayers(fastify.redis, { server: targetServer });

    const acPlayers = onlinePlayersInServer.map(p => ({
      name: p.name,
      guid: p.guid,
      playerNum: p.playerNum
    }));

    connection.socket.send(JSON.stringify({
      action: 'ac_status_result',
      data: {
        count: acPlayers.length,
        players: acPlayers
      }
    }));

  } catch (err) {
    fastify.log.error(`Failed to process AC status for Client ${currentClientId}:`, err);
    connection.socket.send(JSON.stringify({ status: 'error', message: 'Internal server error.' }));
  }
};