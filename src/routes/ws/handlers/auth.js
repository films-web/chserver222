module.exports = async function handleAuth(fastify, connection, payload) {
  try {
    fastify.log.info("[AUTH] Incoming auth request");

    if (!payload || !payload.data) {
      fastify.log.warn("[AUTH] Missing payload.data");
      connection.sendError('auth_result', 'Invalid payload.');
      connection.socket.close(1008, "Invalid Payload");
      return null;
    }

    const { hwid, signature } = payload.data;

    fastify.log.info(`[AUTH] HWID: ${hwid}`);
    fastify.log.info(`[AUTH] Signature length: ${signature?.length || 0}`);

    if (!isValidSignature(hwid, signature)) {
      fastify.log.warn(`[AUTH] Invalid signature for HWID: ${hwid}`);

      connection.sendError('auth_result', 'Invalid signature.');
      connection.socket.close(1008, "Policy Violation");

      return null;
    }

    fastify.log.info("[AUTH] Signature valid, logging in client...");

    const { clientId, clientGuid } =
      await loginOrRegisterClient(fastify.db, hwid, signature);

    fastify.log.info(`[AUTH] Client ID: ${clientId}`);
    fastify.log.info(`[AUTH] Client GUID: ${clientGuid}`);

    const customGuid = await getSpoofedGuid(fastify.db, clientGuid);
    const finalActiveGuid = customGuid || clientGuid;

    fastify.log.info(`[AUTH] Final GUID: ${finalActiveGuid}`);

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

    fastify.log.info("[AUTH] Redis state stored");

    connection.sendSuccess('auth_result', { guid: finalActiveGuid });

    fastify.log.info("[AUTH] auth_result sent to client");

    return clientId;

  } catch (err) {
    fastify.log.error("[AUTH] Exception occurred:", err);

    connection.sendError('auth_result', 'Internal server error');
    connection.socket.close(1011, "Server Error");

    return null;
  }
};