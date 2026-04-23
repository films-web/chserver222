const onlinePlayerService = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, connection, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const player = await onlinePlayerService.getPlayerState(fastify.redis, currentClientId);

        connection.socket.send(JSON.stringify({
            action: 'set_guid',
            guid: player.guid || "N/A"
        }));

    } catch (error) {
        fastify.log.error(`[WS Error] Failed to handle request_guid for ${currentClientId}: ${error.message}`);
    }
};