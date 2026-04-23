const payloadService = require('../../../services/payloadService');

module.exports = async function handleRequestPayload(fastify, connection, currentClientId) {
  if (!currentClientId) return;

  try {
    const activePayload = await payloadService.getActivePayload(fastify.db);
    
    if (!activePayload) {
      return connection.sendError('payload_info', 'No active payload configuration found.');
    }

    connection.sendSuccess('payload_info', {
      url: activePayload.url,
      hash: activePayload.hash,
      fileName: activePayload.fileName || 'cheatharam.dll'
    });

  } catch (error) {
    connection.sendError('payload_info', 'Internal server error retrieving payload info.');
  }
};