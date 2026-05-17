const fs = require('fs');
const path = require('path');

async function saveFairshot(fastify, guid, clientId, serverIp, compressedData, playerName, captureTime) {
  if (!compressedData || compressedData.length === 0) {
    throw new Error('Empty image payload.');
  }

  try {
    const uniqueFileName = `fairshot_${guid}_${Date.now()}.jpeg`;
    const saveDir = path.join(__dirname, '../../uploads/fairshots');
    const savePath = path.join(saveDir, uniqueFileName);

    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    fs.writeFileSync(savePath, compressedData);

    const imageUrl = `https://api.ch-sof2.online/uploads/fairshots/${uniqueFileName}`;
    
    const captureDate = captureTime ? new Date(Number(captureTime) * 1000) : new Date();

    await fastify.db.query(
      `INSERT INTO "Fairshot" ("clientId", "imageUrl", "server", "playerName", "createdAt") 
       VALUES ($1, $2, $3, $4, $5)`,
      [clientId, imageUrl, serverIp || 'Unknown Server', playerName || 'Unknown', captureDate]
    );

    fastify.log.info(`[FAIRSHOT] Saved JPEG for Client ID: ${clientId}`);
    return imageUrl;

  } catch (err) {
    fastify.log.error(err, `[Fairshot] Error saving fairshot for ${clientId}`);
    throw new Error('Failed to save fairshot: ' + err.message);
  }
}

module.exports = {
  saveFairshot
};