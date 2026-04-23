const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, connection, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const player = await getPlayerState(fastify.redis, currentClientId);
        
        if (!player || !player.guid) {
            return connection.sendError('set_guid', 'Could not retrieve GUID from session.');
        }

        connection.sendSuccess('set_guid', { guid: player.guid });

    } catch (error) {
        connection.sendError('set_guid', 'Internal server error processing GUID request.');
    }
};