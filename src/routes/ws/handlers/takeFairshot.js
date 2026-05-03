const { saveFairshot } = require('../../../services/fairshotService');
const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, connection, currentClientId, payload) {
    const challengeKey = `fairshot_challenge:${currentClientId}`;
    const challengeDataRaw = await fastify.redis.get(challengeKey);
    
    if (!challengeDataRaw) {
        fastify.log.warn(`[Security] Client ${currentClientId} tried to upload fairshot with no active challenge.`);
        return;
    }

    let requestId, requesterClientId, requestTime;
    try {
        const parsed = JSON.parse(challengeDataRaw);
        requestId = parsed.requestId;
        requesterClientId = parsed.requesterClientId;
        requestTime = parsed.requestTime;
    } catch (e) {
        fastify.log.error(`[Security] Challenge data corruption for ${currentClientId}`);
        return;
    }
    
    const timeElapsed = Date.now() - requestTime;
    if (timeElapsed > 5000) {
        fastify.log.warn(`[Security] Client ${currentClientId} upload too slow (${timeElapsed}ms). Potential fake.`);
        await fastify.redis.del(challengeKey);
        return;
    }

    if (requestId !== payload.target) {
        fastify.log.warn(`[Security] Client ${currentClientId} provided wrong challenge ID.`);
        return;
    }

    try {
        const player = await getPlayerState(fastify.redis, currentClientId);
        if (!player || !player.guid) throw new Error('Player GUID not found for verification.');

        const crypto = require('crypto');
        const expectedSignature = crypto.createHmac('sha256', player.guid)
            .update(Buffer.concat([payload.imageData, Buffer.from(requestId)]))
            .digest('hex');

        if (expectedSignature !== payload.signature) {
            fastify.log.warn(`[Security] Client ${currentClientId} invalid fairshot signature!`);
            await fastify.redis.del(challengeKey);
            return;
        }
        
        await fastify.redis.del(challengeKey);

        const serverIp = player.server || 'Unknown';
        await saveFairshot(fastify, currentClientId, serverIp, payload.imageData);
        
        connection.sendSuccess('FAIRSHOT_ACK');

        if (requesterClientId) {
            for (const client of fastify.websocketServer.clients) {
                if (String(client.clientId) === String(requesterClientId)) {
                    client.sendSuccess('FAIRSHOT_ACK', { message: `Fairshot from ${player ? player.name : currentClientId} is ready! View it at: https://ch-sof2.online` });
                    break;
                }
            }
        }
    } catch (err) {
        fastify.log.error(err, `[Fairshot] Error saving fairshot for ${currentClientId}`);
    }
};
