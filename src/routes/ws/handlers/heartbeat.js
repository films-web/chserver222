module.exports = async function handleHeartbeat(fastify, connection, currentClientId) {
  if (!currentClientId) return; 

  const timeoutSec = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10);

  await fastify.redis.expire(`player:${currentClientId}`, timeoutSec);
  
  connection.socket.send(JSON.stringify({ status: 'ack' }));
};