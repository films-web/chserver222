const onlinePlayerService = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, connection, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const requester = await onlinePlayerService.getPlayerState(fastify.redis, currentClientId);
        
        if (!requester || !requester.server) return;

        const targetIdentifier = payload.target;
        if (!targetIdentifier) return;

        connection.socket.send(JSON.stringify({
            action: 'fairshot_ack',
            status: 'success'
        }));

        fastify.log.info(`[Fairshot] Player ${currentClientId} requested fairshot on ${targetIdentifier}`);

    } catch (error) {
        fastify.log.error(`[WS Error] Failed to handle request_fairshot for ${currentClientId}: ${error.message}`);
    }
};