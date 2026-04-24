module.exports = async function handleHeartbeat(fastify, socket, currentClientId) {
  if (!currentClientId) return;

  try {
    const timeoutSec = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10);
    await fastify.redis.expire(`player:${currentClientId}`, timeoutSec);
    socket.sendSuccess('heartbeat');

  } catch (err) {
    socket.sendError('heartbeat', 'Internal server error processing heartbeat.');
  }
};