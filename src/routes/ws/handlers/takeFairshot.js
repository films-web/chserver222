const { saveFairshot } = require('../../../services/fairshotService');
const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function (fastify, connection, currentClientId, payload) {
    const challengeKey = `fairshot_challenge:${currentClientId}`;
    const challengeDataRaw = await fastify.redis.get(challengeKey);
    
    if (!challengeDataRaw) {
        fastify.log.warn(`[Security] Client ${currentClientId} tried to upload fairshot with no active challenge.`);
        return;
    }

    let requestId, requesterClientId, watermarkSecret;
    try {
        const parsed = JSON.parse(challengeDataRaw);
        requestId = parsed.requestId;
        requesterClientId = parsed.requesterClientId;
        watermarkSecret = parsed.watermarkSecret;
    } catch (e) {
        fastify.log.error(`[Security] Challenge data corruption for ${currentClientId}`);
        return;
    }
    
    const fairshot = payload.fairshot || payload.fairshot_data;
    if (!fairshot || !fairshot.image_data) {
        fastify.log.error(`[Fairshot] Missing fairshot data for client ${currentClientId}`);
        return;
    }

    if (requestId !== fairshot.request_id) {
        fastify.log.warn(`[Security] Client ${currentClientId} provided wrong challenge ID. Expected: ${requestId}, Got: ${fairshot.request_id}`);
        return;
    }

    const clientCaptureTime = Number(fairshot.capture_time) || 0;

    try {
        const player = await getPlayerState(fastify.redis, currentClientId);
        if (!player || !player.guid) throw new Error('Player GUID not found for verification.');

        let imageBuffer;
        if (Buffer.isBuffer(fairshot.image_data) || fairshot.image_data instanceof Uint8Array) {
            imageBuffer = Buffer.from(fairshot.image_data);
        } else {
            imageBuffer = Buffer.from(String(fairshot.image_data), 'base64');
        }

        const watermarkBuffer = Buffer.from(watermarkSecret, 'utf8');
        const secretIndex = imageBuffer.lastIndexOf(watermarkBuffer);

        if (secretIndex === -1) {
            fastify.log.warn(`[Security] Client ${currentClientId} uploaded fairshot without valid watermark!`);
            await fastify.redis.del(challengeKey);
            connection.sendSuccess('FAIRSHOT_ACK');
            return;
        }

        fastify.log.info(`[Security] Watermark verified for client ${currentClientId}`);
        
        const cleanImageBuffer = imageBuffer.subarray(0, secretIndex);

        await fastify.redis.del(challengeKey);

        const serverIp = player.server || 'Unknown';
        const cleanName = player.name ? player.name.replace(/\^./g, '').trim() : 'Unknown';

        await saveFairshot(fastify, player.guid, currentClientId, serverIp, cleanImageBuffer, cleanName, clientCaptureTime);
        
        connection.sendSuccess('FAIRSHOT_ACK');

        if (requesterClientId) {
            for (const client of fastify.websocketServer.clients) {
                if (String(client.clientId) === String(requesterClientId)) {
                    client.sendSuccess('FAIRSHOT_ACK', { 
                        message: `^3[CheatHaram] ^7Fairshot of ${cleanName} is successfully verified and ready! View it at: https://ch-sof2.online\n` 
                    });
                    break;
                }
            }
        }
    } catch (err) {
        fastify.log.error(err, `[Fairshot] Error saving fairshot for ${currentClientId}`);
    }
};