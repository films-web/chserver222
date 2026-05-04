const { getOnlinePlayers, getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestAcStatus(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const requestingPlayer = await getPlayerState(fastify.redis, currentClientId);
    if (!requestingPlayer || !requestingPlayer.server || requestingPlayer.server === 'In Lobby') {
      return socket.sendError('PLAYER_LIST_RESULT', 'Requester not in a valid server.');
    }

    const targetServer = requestingPlayer.server;
    const onlinePlayersInServer = await getOnlinePlayers(fastify.redis, { server: targetServer });
  
    const acPlayers = onlinePlayersInServer.map(p => ({
      id: parseInt(p.playerNum, 10),
      guid: p.guid || "N/A",
      name: p.name || 'N/A'
    }));
    
    socket.sendSuccess('PLAYER_LIST_RESULT', {
        players_list: acPlayers 
    });

  } catch (err) {
    fastify.log.error(`AC Status error for client ${currentClientId}:`, err);
    socket.sendError('PLAYER_LIST_RESULT', 'Internal server error processing AC Status.');
  }
};