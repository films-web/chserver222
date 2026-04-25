const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

module.exports = async function handleFairshotUpload(fastify, socket, currentClientId, payload) {
    try {
        fastify.log.info(`[Fairshot Debug] -> Received 'fairshot_upload' from Client ID: ${currentClientId}`);
        
        if (!currentClientId) return;

        const base64Data = payload.data?.image;
        if (!base64Data) {
            fastify.log.warn(`[Fairshot Debug] -> Payload from Client ${currentClientId} is missing image data!`);
            return;
        }

        fastify.log.info(`[Fairshot Debug] -> Image data found. Size: ${base64Data.length} characters. Processing...`);

        const imageBuffer = Buffer.from(base64Data, 'base64');

        const publicDir = path.join(__dirname, '../../../../uploads/fairshots');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }

        const fileName = `${currentClientId}_${Date.now()}_${randomUUID().substring(0,6)}.jpg`;
        const savePath = path.join(publicDir, fileName);
        
        fs.writeFileSync(savePath, imageBuffer);
        const imageUrl = `/fairshots/${fileName}`;

        const playerState = await fastify.redis.hgetall(`player:${currentClientId}`);
        const serverName = playerState && playerState.server ? playerState.server : 'Unknown';
        
        await fastify.db.query(
            `INSERT INTO "Fairshot" ("clientId", "imageUrl", "server") VALUES ($1, $2, $3)`,
            [currentClientId, imageUrl, serverName]
        );

        fastify.log.info(`[Fairshot Success] Screenshot saved to disk and database for Client ID ${currentClientId}`);

    } catch (error) {
        fastify.log.error(`[Fairshot Error]: Failed to process upload - ${error.message}`);
    }
};