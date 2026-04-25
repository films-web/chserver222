const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

module.exports = async function handleFairshotUpload(fastify, socket, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const base64Data = payload.data?.image;
        if (!base64Data) return;

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

        fastify.log.info(`[Fairshot] Uploaded and saved screenshot for Client ID ${currentClientId}`);

    } catch (error) {
        fastify.log.error(`[Fairshot Error]: Failed to process upload - ${error.message}`);
    }
};