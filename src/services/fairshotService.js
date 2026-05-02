const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Saves a fairshot to disk and database.
 * @param {object} fastify - Fastify instance
 * @param {string} clientId - Client ID of the player
 * @param {string} serverIp - IP of the server where the player is
 * @param {Buffer} compressedData - Compressed image data (zlib)
 * @returns {Promise<string>} - The URL of the saved image
 */

async function saveFairshot(fastify, clientId, serverIp, compressedData) {
  if (!compressedData || compressedData.length === 0) {
    throw new Error('Empty image payload.');
  }

  try {
    const bmpBuffer = zlib.inflateSync(compressedData);

    const uniqueFileName = `fairshot_${clientId}_${Date.now()}.bmp`;
    const saveDir = path.join(__dirname, '../../../uploads/fairshots');
    const savePath = path.join(saveDir, uniqueFileName);

    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    fs.writeFileSync(savePath, bmpBuffer);

    const imageUrl = `https://api.ch-sof2.online/uploads/fairshots/${uniqueFileName}`;
    await fastify.db.query(
      `INSERT INTO "Fairshot" ("clientId", "imageUrl", "server", "createdAt") 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [clientId, imageUrl, serverIp || 'Unknown Server']
    );

    fastify.log.info(`[FAIRSHOT] Saved screenshot via WSS for Client ID: ${clientId}`);
    return imageUrl;

  } catch (err) {
    fastify.log.error(`[FAIRSHOT SERVICE ERROR] ${err.message}`);
    throw new Error('Failed to process screenshot decompression: ' + err.message);
  }
}

module.exports = {
  saveFairshot
};
