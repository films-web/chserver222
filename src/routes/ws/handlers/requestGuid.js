const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestGuid(fastify, socket, currentClientId) {
    try {
        if (!currentClientId) return;

        const player = await getPlayerState(fastify.redis, currentClientId);
        
        if (!player || !player.guid) {
            return socket.sendError('SET_GUID', 'Could not retrieve GUID from session.');
        }

        socket.sendSuccess('SET_GUID', { guid: player.guid });

    } catch (error) {
        fastify.log.error(`GUID request error for client ${currentClientId}:`, error);
        socket.sendError('SET_GUID', 'Internal server error processing GUID request.');
    }
};