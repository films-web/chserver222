const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, connection, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const requester = await getPlayerState(fastify.redis, currentClientId);
        if (!requester || !requester.server) {
            return connection.sendError('fairshot_ack', 'You must be in a server to request a fairshot.');
        }

        const targetIdentifier = payload.target;
        if (!targetIdentifier) {
            return connection.sendError('fairshot_ack', 'Target identifier missing.');
        }

        fastify.log.info(`[Fairshot] Player ${currentClientId} requested fairshot on ${targetIdentifier}`);

        connection.sendSuccess('fairshot_ack');

    } catch (error) {
        connection.sendError('fairshot_ack', 'Internal server error processing fairshot request.');
    }
};