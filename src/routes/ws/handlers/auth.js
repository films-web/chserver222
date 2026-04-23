const { isValidSignature } = require('../../../utils/security');
const { loginOrRegisterClient } = require('../../../services/clientService');
const { getSpoofedGuid } = require('../../../services/guidService');

module.exports = async function handleAuth(fastify, connection, payload) {
  const { hwid, signature, name = 'UnnamedPlayer' } = payload.data;

  if (!isValidSignature(hwid, signature)) {
    connection.sendError('auth_result', 'Invalid signature.');
    connection.socket.close(1008, "Policy Violation"); 
    return null;
  }

  const { clientId, clientGuid } = await loginOrRegisterClient(fastify.db, hwid, signature, name);

  const customGuid = await getSpoofedGuid(fastify.db, clientGuid);
  const finalActiveGuid = customGuid || clientGuid;

  const redisKey = `player:${clientId}`;

  const coloredName = name;
  const cleanName = name ? name.replace(/\^./g, '') : 'Unknown';

  await fastify.redis.hset(redisKey, {
    guid: finalActiveGuid,
    originalGuid: clientGuid, 
    name: cleanName,
    displayName: coloredName, 
    state: 0,
    server: 'In Lobby',
    playerNum: -1
  });

  const timeoutSec = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10);
  await fastify.redis.expire(redisKey, timeoutSec);

  connection.sendSuccess('auth_result', { guid: finalActiveGuid });
  
  return clientId;
};