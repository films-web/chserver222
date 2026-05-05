const { getOnlinePlayers } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestGuid(fastify) {
    try {
        const allPlayers = await getOnlinePlayers(fastify.redis);

        if (!allPlayers || allPlayers.length === 0) {
            return;
        }

        for (const client of fastify.websocketServer.clients) {
            if (!client.clientId) continue;

            const player = allPlayers.find(p => p.clientId === client.clientId);
            if (!player || !player.guid) continue;

            client.sendSuccess('SET_GUID', {
                guid: {
                    guid: player.guid
                }
            });
        }

    } catch (error) {
        fastify.log.error(`GUID broadcast error:`, error);
    }
};