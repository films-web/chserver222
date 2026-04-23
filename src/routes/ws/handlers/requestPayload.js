const { getActivePayload } = require('../../../services/payloadService');

module.exports = async function handleRequestPayload(fastify, connection, currentClientId) {
  if (!currentClientId) {
    return;
  }

  try {
    const payload = await getActivePayload(fastify.db);

    if (!payload) {
      fastify.log.warn(`Client ${currentClientId} requested payload, but no active payload was found in DB.`);
      return connection.socket.send(JSON.stringify({ status: 'error', message: 'No active payload available.' }));
    }

    connection.socket.send(JSON.stringify({
      action: 'payload_info',
      data: {
        id: payload.id,
        url: payload.url,
        hash: payload.fileHash,
        fileName: payload.fileName,
        version: payload.version
      }
    }));
    fastify.log.info(`Payload [${payload.version}] metadata served to Client ${currentClientId}`);
  } catch (err) {
    fastify.log.error(`Failed to serve payload to Client ${currentClientId}:`, err.message);
    connection.socket.send(JSON.stringify({ status: 'error', message: 'Internal server error.' }));
  }
};