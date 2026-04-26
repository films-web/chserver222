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

        const reqServerClean = requester.server.trim();
        fastify.log.info(`[Fairshot-Debug] Admin ${currentClientId} searching for Slot: ${targetPlayerNum} on Server: "${reqServerClean}"`);

        let targetClientId = null;
        const keys = await fastify.redis.keys('player:*');

        for (const key of keys) {
            const state = await fastify.redis.hgetall(key);
            const targetServerClean = (state.server || '').trim();
            const currentSlot = parseInt(state.playerNum, 10);

            if (targetServerClean === reqServerClean && currentSlot === targetPlayerNum) {
                targetClientId = key.split(':')[1]; 
                fastify.log.info(`[Fairshot-Debug] MATCH FOUND! Target is Client ID: ${targetClientId}`);
                break;
            }
        }

        if (!targetClientId) {
            return socket.sendError('fairshot_ack', `No AC player found in slot ${targetPlayerNum} on this server.`);
        }

        const targetConnection = global.activeSockets.get(String(targetClientId));

        if (targetConnection) {
            targetConnection.send(JSON.stringify({
                action: 'take_fairshot'
            }));
            
            socket.sendSuccess('fairshot_ack');
            fastify.log.info(`[Fairshot] Issued 'take_fairshot' command to target client ${targetClientId}`);
        } else {
            fastify.log.warn(`[Fairshot] Target ID ${targetClientId} is in Redis, but missing from activeSockets Map. (Disconnected)`);
            return socket.sendError('fairshot_ack', 'Target player found in cache, but their loader is disconnected.');
        }

    } catch (error) {
        fastify.log.error(`[Fairshot] Error processing request: ${error.message}`);
        socket.sendError('fairshot_ack', 'Internal server error processing fairshot request.');
    }
};