const fs = require('fs');
const path = require('path');
const payloadService = require('../../../services/payloadService');

module.exports = async function handleRequestPayload(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const activePayload = await payloadService.getActivePayload(fastify.db);
    
    if (!activePayload) {
      return socket.sendError('PAYLOAD_RESULT', 'No active payload configuration found.');
    }

    const dllPath = path.join(__dirname, '../../../../uploads/payloads', activePayload.fileName);

    if (!fs.existsSync(dllPath)) {
      return socket.sendError('PAYLOAD_RESULT', 'Physical payload file missing on server.');
    }

    const fileBuffer = fs.readFileSync(dllPath);

    socket.sendSuccess('PAYLOAD_RESULT', {
      dll_bytes: fileBuffer,
      dll_hash: activePayload.fileHash,
      dll_name: activePayload.fileName
    });

  } catch (error) {
    fastify.log.error(`Payload request error for client ${currentClientId}:`, error);
    socket.sendError('PAYLOAD_RESULT', 'Internal server error retrieving payload.');
  }
};