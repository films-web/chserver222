const { getAllWhitelistedHashes } = require('../../../services/whitelistService');

module.exports = async function handleRequestWhitelist(fastify, connection, currentClientId) {
  if (!currentClientId) {
    return;
  }

  try {
    const validHashes = await getAllWhitelistedHashes(fastify.db);
    connection.socket.send(JSON.stringify({
      action: 'whitelist_data',
      data: { hashes: validHashes }
    }));
    fastify.log.info(`Sent ${validHashes.length} whitelist hashes to Client ${currentClientId}`);
  } catch (err) {
    fastify.log.error(`Failed to send whitelist to Client ${currentClientId}:`, err);
    connection.socket.send(JSON.stringify({ status: 'error', message: 'Internal server error' }));
  }
};