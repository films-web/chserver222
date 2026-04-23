module.exports = async function handleHeartbeat(fastify, connection, currentClientId) {
  if (!currentClientId) return; 

  try {
    const timeoutSec = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10);
    await fastify.redis.expire(`player:${currentClientId}`, timeoutSec);
    connection.sendSuccess('heartbeat');

  } catch (err) {
    connection.sendError('heartbeat', 'Internal server error processing heartbeat.');
  }
};