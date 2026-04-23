const { getOnlinePlayers, getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestAcStatus(fastify, connection, currentClientId) {
  if (!currentClientId) return;

  try {
    const requestingPlayer = await getPlayerState(fastify.redis, currentClientId);
    
    if (!requestingPlayer || !requestingPlayer.server || requestingPlayer.server === 'In Lobby') {
      return connection.sendError('player_list_result', 'Requester not in a valid server.');
    }

    const targetServer = requestingPlayer.server;
    const onlinePlayersInServer = await getOnlinePlayers(fastify.redis, { server: targetServer });

    const acPlayers = onlinePlayersInServer.map(p => ({
      name: p.name || 'Unknown',
      guid: p.guid,
      id: parseInt(p.playerNum, 10),
      state: parseInt(p.state, 10)
    }));

    connection.sendSuccess('player_list_result', {
        count: acPlayers.length,
        players: acPlayers
    });

  } catch (err) {
    connection.sendError('player_list_result', 'Internal server error processing AC Status.');
  }
};