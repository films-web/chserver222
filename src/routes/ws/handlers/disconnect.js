module.exports = async function handleDisconnect(fastify, currentClientId) {
  if (!currentClientId) return;
  
  fastify.log.info(`Client ${currentClientId} disconnected gracefully.`);

  await fastify.redis.del(`player:${currentClientId}`);

  fastify.db.query(
    `UPDATE clients SET "lastSeen" = CURRENT_TIMESTAMP WHERE id = $1`, 
    [currentClientId]
  ).catch(err => fastify.log.error('Failed to update lastSeen:', err));
};