const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, socket, currentClientId) {
    try {
        if (!currentClientId) return;

        const player = await getPlayerState(fastify.redis, currentClientId);
        
        if (!player || !player.guid) {
            return socket.sendError('set_guid', 'Could not retrieve GUID from session.');
        }

        socket.sendSuccess('set_guid', { guid: player.guid });

    } catch (error) {
        socket.sendError('set_guid', 'Internal server error processing GUID request.');
    }
};