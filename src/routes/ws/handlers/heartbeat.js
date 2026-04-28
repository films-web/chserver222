module.exports = async function handleHeartbeat(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const timeoutSec = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10);
    const redisKey = `player:${currentClientId}`;
    await fastify.redis.expire(redisKey, timeoutSec);
    socket.sendSuccess('HEARTBEAT');

  } catch (err) {
    fastify.log.error(`Heartbeat error for client ${currentClientId}:`, err);
    socket.sendError('HEARTBEAT', 'Internal server error processing heartbeat.');
  }
};