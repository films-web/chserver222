const whitelistService = require('../../../services/whitelistService');

module.exports = async function handleRequestWhitelist(fastify, connection, currentClientId) {
  if (!currentClientId) return;

  try {
    const activeHashes = await whitelistService.getAllWhitelistedHashes(fastify.db);
    connection.sendSuccess('whitelist_data', { hashes: activeHashes });

  } catch (error) {
    connection.sendError('whitelist_data', 'Internal server error retrieving whitelist.');
  }
};