const whitelistService = require('../../../services/whitelistService');

module.exports = async function handleRequestWhitelist(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const activeHashes = await whitelistService.getAllWhitelistedHashes(fastify.db);
    socket.sendSuccess('whitelist_data', { hashes: activeHashes });

  } catch (error) {
    socket.sendError('whitelist_data', 'Internal server error retrieving whitelist.');
  }
};