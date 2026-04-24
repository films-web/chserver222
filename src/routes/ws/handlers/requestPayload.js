const payloadService = require('../../../services/payloadService');

module.exports = async function handleRequestPayload(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const activePayload = await payloadService.getActivePayload(fastify.db);
    
    if (!activePayload) {
      return socket.sendError('payload_info', 'No active payload configuration found.');
    }

    socket.sendSuccess('payload_info', {
      url: activePayload.url,
      hash: activePayload.fileHash,
      fileName: activePayload.fileName || 'cheatharam.dll'
    });

  } catch (error) {
    socket.sendError('payload_info', 'Internal server error retrieving payload info.');
  }
};