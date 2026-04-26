const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestFairshot(fastify, socket, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const requester = await getPlayerState(fastify.redis, currentClientId);
        if (!requester || !requester.server) {
            return socket.sendError('fairshot_ack', 'You must be in a server to request a fairshot.');
        }

        const targetPlayerNum = parseInt(payload.target.replace(/#/g, '').trim(), 10);
        if (isNaN(targetPlayerNum)) {
            return socket.sendError('fairshot_ack', 'Invalid target slot number.');
        }

        fastify.log.info(`[Fairshot] Admin ${currentClientId} requested fairshot on slot ${targetPlayerNum}`);

        let targetClientId = null;
        const keys = await fastify.redis.keys('player:*');

        for (const key of keys) {
            const state = await fastify.redis.hgetall(key);
            
            if (state.server === requester.server && parseInt(state.playerNum, 10) === targetPlayerNum) {
                targetClientId = key.split(':')[1]; 
                break;
            }
        }

        if (!targetClientId) {
            return socket.sendError('fairshot_ack', `No AC player found in slot ${targetPlayerNum} on this server.`);
        }

        let targetSocket = null;
        for (const client of fastify.websocketServer.clients) {
            if (client.clientId == targetClientId) {
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
            return socket.sendError('fairshot_ack', 'Target player found, but their loader disconnected.');
        }

    } catch (error) {
        fastify.log.error(`[Fairshot] Error processing request: ${error.message}`);
        socket.sendError('fairshot_ack', 'Internal server error processing fairshot request.');
    }
};