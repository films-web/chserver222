const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { getPlayerState } = require('../../../services/onlinePlayerService');

module.exports = async function handleUploadFairshot(fastify, socket, currentClientId, payload) {
    try {
        if (!currentClientId) return;

        const { image } = payload.data || {};
        if (!image) {
            return socket.sendError('upload_fairshot', 'Image data missing.');
        }

        const playerState = await getPlayerState(fastify.redis, currentClientId);
        const currentServer = playerState?.server || 'Unknown Server';

        const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, '');
        const buffer = Buffer.from(cleanBase64, 'base64');

        const uploadDir = path.join(process.cwd(), 'uploads', 'fairshots');
        const fileName = `fairshot_${currentClientId}_${Date.now()}.jpg`;
        const filePath = path.join(uploadDir, fileName);

        if (!fsSync.existsSync(uploadDir)) {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        await fs.writeFile(filePath, buffer);

        const imageUrl = `/uploads/fairshots/${fileName}`;
        await fastify.db.query(
            `INSERT INTO "Fairshot" ("clientId", "imageUrl", "server", createdAt) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [currentClientId, imageUrl, currentServer]
        );

        fastify.log.info(`[Fairshot] Successfully saved fairshot for client ${currentClientId}`);
    } catch (error) {
        fastify.log.error(`[Fairshot] Error saving fairshot for client ${currentClientId}: ${error.message}`);
        socket.sendError('upload_fairshot', 'Failed to process fairshot upload.');
    }
};