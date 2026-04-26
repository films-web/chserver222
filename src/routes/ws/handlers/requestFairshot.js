const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleRequestFairshot(fastify, socket, currentClientId, payload) {
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

        fastify.log.info(`[Fairshot] Player ${currentClientId} requested fairshot on ${targetIdentifier}`);

        const targetRes = await fastify.db.query('SELECT id FROM clients WHERE guid = $1', [targetIdentifier.trim()]);
        
        if (targetRes.rowCount === 0) {
            return socket.sendError('fairshot_ack', `Target player (${targetIdentifier}) not found in the database.`);
        }
        
        const targetClientId = targetRes.rows[0].id;

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