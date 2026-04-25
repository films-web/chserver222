const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, socket, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const requester = await getPlayerState(fastify.redis, currentClientId);
        if (!requester || !requester.server) {
            return socket.sendError('fairshot_ack', 'You must be in a server to request a fairshot.');
        }

        const targetIdentifier = payload.target;
        if (!targetIdentifier) {
            return socket.sendError('fairshot_ack', 'Target identifier missing.');
        }

        socket.sendSuccess('fairshot_ack');
        fastify.log.info(`[Fairshot] Player ${currentClientId} requested fairshot on ${targetIdentifier}`);

        let targetClientId = null; 
        const allKeys = await fastify.redis.keys('player:*');
        
        for (const key of allKeys) {
            const player = await fastify.redis.hgetall(key);
            if (targetIdentifier.startsWith('#')) {
                const targetNum = targetIdentifier.substring(1);
                if (player.playerNum && player.playerNum.toString() === targetNum) {
                    targetClientId = key.split(':')[1];
                    break;
                }
            } else if (player.guid === targetIdentifier) {
                targetClientId = key.split(':')[1];
                break;
            }
        }

        if (!targetClientId) {
            return fastify.log.warn(`[Fairshot] Could not find active target for ${targetIdentifier}`);
        }

        for (const client of fastify.websocketServer.clients) {
            if (client.clientId && client.clientId.toString() === targetClientId.toString()) {
                client.send(JSON.stringify({ action: "force_screenshot" }));
                fastify.log.info(`[Fairshot] Sent force_screenshot command to target Client ID: ${targetClientId}`);
                break;
            }
        }
    } catch (error) {
        fastify.log.error(`[Fairshot Error]: ${error.message}`);
        socket.sendError('fairshot_ack', 'Internal server error processing fairshot request.');
    }
};