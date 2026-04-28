const { getPlayerState, getOnlinePlayers } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, socket, currentClientId, payload) {
    try {
        if (!currentClientId) return;
        
        const requester = await getPlayerState(fastify.redis, currentClientId);
        if (!requester || !requester.server || requester.server === 'In Lobby') {
            return socket.sendError('REQUEST_FAIRSHOT', 'You must be in a server to request a fairshot.');
        }

        const targetIdentifier = payload.target;
        if (!targetIdentifier) {
            return socket.sendError('REQUEST_FAIRSHOT', 'Target identifier missing.');
        }

        const playersInServer = await getOnlinePlayers(fastify.redis, { server: requester.server });
        const targetPlayer = playersInServer.find(p => 
            p.playerNum === targetIdentifier || p.guid === targetIdentifier
        );

        if (!targetPlayer) {
            return socket.sendError('REQUEST_FAIRSHOT', 'Target not found or not using our anticheat.');
        }

        let targetSocket = null;
        for (const client of fastify.websocketServer.clients) {
            if (client.clientId === targetPlayer.clientId) {
                targetSocket = client;
                break;
            }
        }

        if (!targetSocket) {
            return socket.sendError('REQUEST_FAIRSHOT', 'Target is online but connection is unstable.');
        }

        targetSocket.sendSuccess('REQUEST_FAIRSHOT');
        
        socket.sendSuccess('FAIRSHOT_ACK');

        fastify.log.info(`[Fairshot] Player ${currentClientId} triggered fairshot on Target ${targetPlayer.clientId}`);

    } catch (error) {
        fastify.log.error(`Fairshot request error for client ${currentClientId}:`, error);
        socket.sendError('REQUEST_FAIRSHOT', 'Internal server error processing fairshot request.');
    }
};