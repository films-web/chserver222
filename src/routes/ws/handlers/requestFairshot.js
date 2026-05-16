const crypto = require('crypto');
const { getPlayerState, getOnlinePlayers } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, socket, currentClientId, payload) {
    try {
        if (!currentClientId) return;
        
        const requester = await getPlayerState(fastify.redis, currentClientId);
        if (!requester || !requester.server || requester.server === 'In Lobby') {
            return socket.sendSuccess('FAIRSHOT_ACK', { message: '^3[CheatHaram] ^7You must be in a server to request a fairshot.' });
        }

        const targetIdentifier = payload.target;
        if (!targetIdentifier) return;

        const cleanTarget = targetIdentifier.startsWith('#') 
            ? targetIdentifier.substring(1) 
            : targetIdentifier;

        const playersInServer = await getOnlinePlayers(fastify.redis, { server: requester.server });
        
        const targetPlayer = playersInServer.find(p => 
            String(p.playerNum) === cleanTarget || p.guid === cleanTarget
        );

        if (!targetPlayer) {
            return socket.sendSuccess('FAIRSHOT_ACK', { message: '^3[CheatHaram] ^7Target not found or not using our anticheat.' });
        }

        if (targetPlayer.clientId === currentClientId) {
            return socket.sendSuccess('FAIRSHOT_ACK', { message: '^3[CheatHaram] ^7You cannot request a fairshot on yourself.' });
        }

        let targetSocket = null;
        for (const client of fastify.websocketServer.clients) {
            if (client.clientId === targetPlayer.clientId) {
                targetSocket = client;
                break;
            }
        }

        if (!targetSocket) {
            return socket.sendSuccess('FAIRSHOT_ACK', { message: '^3[CheatHaram] ^7Target is online but connection is unstable. Try again in a moment.' });
        }


        const watermarkSecret = crypto.randomBytes(10).toString('hex'); 
        const requestId = crypto.randomBytes(8).toString('hex');

        await fastify.redis.set(`fairshot_challenge:${targetPlayer.clientId}`, JSON.stringify({
            requestId,
            requesterClientId: String(currentClientId),
            requestTime: Date.now(),
            watermarkSecret
        }), 'EX', 30);

        targetSocket.sendSuccess('REQUEST_FAIRSHOT', { 
            fairshot_req: {
                request_id: requestId,
                watermark_secret: watermarkSecret,
                requester_id: String(currentClientId)
            }
        });
        
        socket.sendSuccess('FAIRSHOT_ACK', { message: `^3[CheatHaram] ^7Fairshot request sent waiting for upload...\n` });
        fastify.log.info(`[Fairshot] Player ${currentClientId} triggered fairshot on Target ${targetPlayer.clientId}`);

    } catch (error) {
        fastify.log.error(`Fairshot request error for client ${currentClientId}:`, error);
    }
};