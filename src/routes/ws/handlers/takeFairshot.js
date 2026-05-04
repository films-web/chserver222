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
    
    const fairshot = payload.fairshot;
    if (!fairshot || !fairshot.image_data) {
        fastify.log.error(`[Fairshot] Missing fairshot data for client ${currentClientId}`);
        return;
    }

    if (requestId !== fairshot.request_id) {
        fastify.log.warn(`[Security] Client ${currentClientId} provided wrong challenge ID. Expected: ${requestId}, Got: ${fairshot.request_id}`);
        return;
    }

    try {
        const player = await getPlayerState(fastify.redis, currentClientId);
        if (!player || !player.guid) throw new Error('Player GUID not found for verification.');

        // Verify the watermarkSecret is embedded in the JPEG data
        // The loader embeds this in the EXIF UserComment (0x9286) tag.
        // We search the buffer for the secret string to confirm it's present.
        const imageBuffer = Buffer.from(fairshot.image_data);
        const watermarkBuffer = Buffer.from(watermarkSecret, 'utf8');
        if (!imageBuffer.includes(watermarkBuffer)) {
            fastify.log.warn(`[Security] Client ${currentClientId} uploaded fairshot without valid watermark!`);
            await fastify.redis.del(challengeKey);
            return;
        }

        fastify.log.info(`[Security] Watermark verified for client ${currentClientId}`);
        
        await fastify.redis.del(challengeKey);

        const serverIp = player.server || 'Unknown';
        const cleanName = player.name ? player.name.replace(/\^./g, '').trim() : 'Unknown';
        await saveFairshot(fastify, currentClientId, serverIp, imageBuffer, cleanName);
        
        connection.sendSuccess('FAIRSHOT_ACK');

        if (requesterClientId) {
            for (const client of fastify.websocketServer.clients) {
                if (String(client.clientId) === String(requesterClientId)) {
                    client.sendSuccess('FAIRSHOT_ACK', { message: `^7Fairshot is ready! View it at: https://ch-sof2.online` });
                    break;
                }
            }
        }
    } catch (err) {
        fastify.log.error(err, `[Fairshot] Error saving fairshot for ${currentClientId}`);
    }
};
