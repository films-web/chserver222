const { isValidSignature } = require('../../../utils/security');
const { loginOrRegisterClient } = require('../../../services/clientService');
const { getSpoofedGuid } = require('../../../services/guidService');

module.exports = async function handleAuth(fastify, socket, payload) {
  const { hwid, signature } = payload.data;

  if (!isValidSignature(hwid, signature)) {
    socket.sendError('auth_result', 'Invalid signature.');
    socket.close(1008, "Policy Violation");
    return null;
  }

  const { clientId, clientGuid } = await loginOrRegisterClient(fastify.db, hwid, signature);

  const customGuid = await getSpoofedGuid(fastify.db, clientGuid);
  const finalActiveGuid = customGuid || clientGuid;

  const redisKey = `player:${clientId}`;

  await fastify.redis.hset(redisKey, {
    guid: finalActiveGuid,
    name: "UnamedPlayer",
    state: 0,
    server: 'In Lobby',
    playerNum: -1
  });

  const timeoutSec = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10);
  await fastify.redis.expire(redisKey, timeoutSec);

  socket.sendSuccess('auth_result', { guid: finalActiveGuid });

  return clientId;
};