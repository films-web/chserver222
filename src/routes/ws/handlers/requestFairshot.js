const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestFairshot(fastify, socket, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const requester = await getPlayerState(fastify.redis, currentClientId);
        if (!requester || !requester.server) {
            return socket.sendError('fairshot_ack', 'You must be in a server to request a fairshot.');
        }

        const rawTargetIdentifier = payload.target;
        if (!rawTargetIdentifier) {
            return socket.sendError('fairshot_ack', 'Target identifier missing.');
        }

        const targetIdentifier = rawTargetIdentifier.replace(/#/g, '').trim();
        fastify.log.info(`[Fairshot] Player ${currentClientId} requested fairshot on target ${targetIdentifier}`);

        let targetClientId = null;

        const keys = await fastify.redis.keys('player:*');
        for (const key of keys) {
            const playerState = await fastify.redis.hgetall(key);
            
            if (playerState.server === requester.server && playerState.playerNum === targetIdentifier) {
                targetClientId = parseInt(key.split(':')[1], 10);
                break;
            }
        }

        if (!targetClientId) {
            const targetRes = await fastify.db.query('SELECT id FROM clients WHERE guid = $1', [targetIdentifier]);
            if (targetRes.rowCount > 0) {
                targetClientId = targetRes.rows[0].id;
            }
        }

        if (!targetClientId) {
            return socket.sendError('fairshot_ack', `Target player (${targetIdentifier}) not found on this server.`);
        }

        let targetSocket = null;
        for (const client of fastify.websocketServer.clients) {
            if (client.clientId === targetClientId) {
                targetSocket = client;
                break;
            }
        }

        if (targetSocket && targetSocket.readyState === 1) {
            
            targetSocket.send(JSON.stringify({
                action: 'take_fairshot'
            }));

            socket.sendSuccess('fairshot_ack');
            fastify.log.info(`[Fairshot] Issued 'take_fairshot' command to target client ${targetClientId}`);
            
        } else {
            return socket.sendError('fairshot_ack', 'Target player is not currently connected to the Loader.');
        }

    } catch (error) {
        fastify.log.error(`[Fairshot] Error processing request: ${error.message}`);
        socket.sendError('fairshot_ack', 'Internal server error processing fairshot request.');
    }
};