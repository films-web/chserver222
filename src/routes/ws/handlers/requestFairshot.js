const { getPlayerState } = require('../../../services/onlinePlayerService');

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

        fastify.log.info(`[Fairshot] Player ${currentClientId} requested fairshot on ${targetIdentifier}`);

        socket.sendSuccess('REQUEST_FAIRSHOT');

    } catch (error) {
        fastify.log.error(`Fairshot request error for client ${currentClientId}:`, error);
        socket.sendError('REQUEST_FAIRSHOT', 'Internal server error processing fairshot request.');
    }
};