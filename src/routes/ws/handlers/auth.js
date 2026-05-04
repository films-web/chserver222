const SecurityUtils = require('../security');
const { loginOrRegisterClient } = require('../../../services/clientService');
const { getSpoofedGuid } = require('../../../services/guidService');
const { getLoaderByVersion, getActiveLoader } = require('../../../services/loaderService');

module.exports = async function handleAuth(fastify, socket, payload) {
  const authData = payload.auth || {};
  const { hwid, signature, version } = authData; 

  if (!hwid || !signature) {
    socket.sendError('AUTH_RESULT', 'Invalid security credentials.');
    return null;
  }

  let loaderSecret = null;
  if (version) {
    const loaderInfo = await getLoaderByVersion(fastify.db, version);
    if (loaderInfo) loaderSecret = loaderInfo.clientSecret;
  }

  if (!SecurityUtils.isValidSignature(hwid, signature, loaderSecret)) {
    socket.sendError('AUTH_RESULT', 'Invalid signature for this loader version.');
    return null;
  }

  const activeLoader = await getActiveLoader(fastify.db);
  if (activeLoader && activeLoader.version !== version) {
    socket.sendSuccess('UPDATE_REQUIRED', {
      update_info: { download_url: activeLoader.url }
    });
    return null;
  }

  const { clientId, clientGuid, currentName } = await loginOrRegisterClient(fastify.db, hwid, signature);
  const customGuid = await getSpoofedGuid(fastify.db, clientGuid);
  const finalActiveGuid = customGuid || clientGuid;

  const redisKey = `player:${clientId}`;
  await fastify.redis.hset(redisKey, {
    guid: finalActiveGuid,
    name: currentName,
    state: 0,
    server: 'In Lobby',
    playerNum: -1
  });
  await fastify.redis.expire(redisKey, 60);

  socket.sendSuccess('AUTH_RESULT', { 
    auth_result: {
      guid: finalActiveGuid,
      server_time: Date.now()
    }
  });

  return clientId;
};