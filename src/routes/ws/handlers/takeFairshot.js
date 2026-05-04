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

    // 1. Verify Request ID
    if (requestId !== fairshot.request_id) {
        fastify.log.warn(`[Security] Client ${currentClientId} provided wrong challenge ID. Expected: ${requestId}, Got: ${fairshot.request_id}`);
        return;
    }

    // 2. NEW SECURITY CHECK: Verify Requester ID matches the protobuf payload
    if (String(requesterClientId) !== String(fairshot.requester_id)) {
        fastify.log.warn(`[Security] Client ${currentClientId} altered requester ID. Expected: ${requesterClientId}, Got: ${fairshot.requester_id}`);
        return;
    }

    try {
        const player = await getPlayerState(fastify.redis, currentClientId);
        if (!player || !player.guid) throw new Error('Player GUID not found for verification.');

        // 3. Verify the watermarkSecret is embedded in the JPEG data
        const imageBuffer = Buffer.from(fairshot.image_data);
        const watermarkBuffer = Buffer.from(watermarkSecret, 'utf8');
        
        if (!imageBuffer.includes(watermarkBuffer)) {
            fastify.log.warn(`[Security] Client ${currentClientId} uploaded fairshot without valid watermark!`);
            await fastify.redis.del(challengeKey);
            return;
        }

        fastify.log.info(`[Security] Watermark verified for client ${currentClientId}`);
        
        // Clean up the challenge so it can't be reused
        await fastify.redis.del(challengeKey);

        const serverIp = player.server || 'Unknown';
        const cleanName = player.name ? player.name.replace(/\^./g, '').trim() : 'Unknown';
        
        // Save to DB / Disk
        await saveFairshot(fastify, currentClientId, serverIp, imageBuffer, cleanName);
        
        // ACK back to the person who uploaded it to unfreeze their chat
        connection.sendSuccess('FAIRSHOT_ACK');

        // Route the success message back to the original requester
        if (fairshot.requester_id) {
            for (const client of fastify.websocketServer.clients) {
                if (String(client.clientId) === String(fairshot.requester_id)) {
                    client.sendSuccess('FAIRSHOT_ACK', { message: `^7Fairshot is ready! View it at: https://ch-sof2.online` });
                    break;
                }
            }
        }
    } catch (err) {
        fastify.log.error(err, `[Fairshot] Error saving fairshot for ${currentClientId}`);
    }
};