const { isValidSignature } = require('../../../utils/security');
const { loginOrRegisterClient } = require('../../../services/clientService');
const { getSpoofedGuid } = require('../../../services/guidService');

module.exports = async function handleAuth(fastify, connection, payload) {
  const { hwid, signature, currentName = 'Unknown' } = payload.data;

  if (!isValidSignature(hwid, signature)) {
    fastify.log.warn(`[SECURITY] Invalid signature from HWID: ${hwid}.`);
    connection.socket.send(JSON.stringify({ status: 'error', message: 'Invalid signature.' }));
    connection.socket.close(1008, "Policy Violation"); 
    return null;
  }

  const { clientId, clientGuid } = await loginOrRegisterClient(fastify.db, hwid, signature);

  const customGuid = await getSpoofedGuid(fastify.db, clientGuid);
  const finalActiveGuid = customGuid || clientGuid;

  const redisKey = `player:${clientId}`;

  await fastify.redis.hset(redisKey, {
    guid: finalActiveGuid,
    name: currentName,
    state: '0',
    server: '',
    playerNum: '-1'
  });

  const timeoutSec = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10);
  await fastify.redis.expire(redisKey, timeoutSec);

  connection.socket.send(JSON.stringify({
    action: 'auth_result',
    status: 'success',
    data: {
      guid: finalActiveGuid 
    }
  }));
  
  return clientId;
};