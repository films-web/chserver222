const onlinePlayerService = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, connection, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const player = await onlinePlayerService.getPlayerState(currentClientId);
        
        if (!player || !player.guid) {
            return;
        }

        connection.socket.send(JSON.stringify({
            action: 'set_guid',
            guid: player.guid
        }));

    } catch (error) {
        fastify.log.error(`[WS Error] Failed to handle request_guid for ${currentClientId}: ${error.message}`);
    }
};