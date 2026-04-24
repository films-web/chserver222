const { getOnlinePlayers, getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestAcStatus(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const requestingPlayer = await getPlayerState(fastify.redis, currentClientId);
    
    if (!requestingPlayer || !requestingPlayer.server || requestingPlayer.server === 'In Lobby') {
      return socket.sendError('player_list_result', 'Requester not in a valid server.');
    }

    const targetServer = requestingPlayer.server;
    const onlinePlayersInServer = await getOnlinePlayers(fastify.redis, { server: targetServer });

    const acPlayers = onlinePlayersInServer.map(p => ({
      name: p.name || 'N/A',
      guid: p.guid || "N/A",
      id: parseInt(p.playerNum, 10),
      state: parseInt(p.state, 10)
    }));

    socket.sendSuccess('player_list_result', {
        count: acPlayers.length,
        players: acPlayers
    });

  } catch (err) {
    socket.sendError('player_list_result', 'Internal server error processing AC Status.');
  }
};