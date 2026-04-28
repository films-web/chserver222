const whitelistService = require('../../../services/whitelistService');

module.exports = async function handleRequestWhitelist(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const activeHashes = await whitelistService.getAllWhitelistedHashes(fastify.db);
    socket.sendSuccess('PK3_WHITELIST_RESULT', { hashes: activeHashes });

  } catch (error) {
    fastify.log.error(`Whitelist request error for client ${currentClientId}:`, error);
    socket.sendError('PK3_WHITELIST_RESULT', 'Internal server error retrieving whitelist.');
  }
};