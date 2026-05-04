const attachWsInterceptor = require('./wsInterceptor');
const handlers = require('./handlers'); // Loads your registry index.js
const processIncomingMessage = require('./messageProcessor');

module.exports = async function (fastify, opts) {
  fastify.get('/connect', { websocket: true }, (connection, req) => {

    const state = {
      clientId: null,
      isAuthed: false,
      lastHeartbeat: Date.now(),
      tokens: 50
    };

    attachWsInterceptor(fastify, connection, state.clientId);

    const refillInterval = setInterval(() => {
      state.tokens = Math.min(state.tokens + 50, 50);
    }, 1000);

    const heartbeatInterval = setInterval(() => {
      const timeout = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10) * 1000;
      if (Date.now() - state.lastHeartbeat > timeout) {
        fastify.log.info(`[WS] Heartbeat timeout for ${state.clientId || 'Unauthed'}`);
        connection.terminate();
      }
    }, 5000);

    const authTimeout = setTimeout(() => {
      if (!state.isAuthed) {
        fastify.log.info('[WS] Auth timeout reached');
        connection.terminate();
      }
    }, 10000);

    connection.on('message', async (message) => {
      try {
        if (message.length > 1024 * 1024) return connection.terminate();
        if (state.tokens-- <= 0) return fastify.log.warn('[WS] Rate limited');

        const payload = await processIncomingMessage(fastify, message, state.clientId);
        
        fastify.log.info(`[WS] Action: ${payload.action} | ID: ${state.clientId}`);

        switch (payload.action) {
          case 'AUTH_REQUEST':
            const authId = await handlers.handleAuth(fastify, connection, payload); 
            if (authId) {
              state.isAuthed = true;
              state.clientId = String(authId);
              connection.clientId = state.clientId;
              clearTimeout(authTimeout);
              attachWsInterceptor(fastify, connection, state.clientId);
            }
            break;

          case 'HEARTBEAT':
            if (!state.isAuthed) return;
            state.lastHeartbeat = Date.now();
            await handlers.handleHeartbeat(fastify, connection, state.clientId);
            break;

          case 'UPDATE_PLAYER_STATE':
            if (!state.isAuthed) return;
            await handlers.handleUpdateState(fastify, connection, state.clientId, payload);
            break;

          case 'PK3_WHITELIST_REQ':
            if (!state.isAuthed) return;
            await handlers.handleRequestWhitelist(fastify, connection, state.clientId);
            break;

          case 'PAYLOAD_REQ':
            if (!state.isAuthed) return;
            await handlers.handleRequestPayload(fastify, connection, state.clientId);
            break;

          case 'PLAYER_LIST_REQ':
            if (!state.isAuthed) return;
            await handlers.handleRequestAcStatus(fastify, connection, state.clientId);
            break;

          case 'GET_GUID_REQ':
            if (!state.isAuthed) return;
            await handlers.handleRequestGuid(fastify, connection, state.clientId, payload);
            break;

          case 'REQUEST_FAIRSHOT':
            if (!state.isAuthed) return;
            await handlers.handleRequestFairshot(fastify, connection, state.clientId, payload);
            break;

          case 'TAKE_FAIRSHOT':
            if (!state.isAuthed) return;
            await handlers.handleTakeFairshot(fastify, connection, state.clientId, payload);
            break;

          default:
            fastify.log.warn(`[WS] No handler found for: ${payload.action}`);
            if (connection.sendError) connection.sendError(payload.action, 'Unknown action');
        }

      } catch (err) {
        fastify.log.error(`[WS] Protocol Error: ${err.message}`);
        if (connection.sendError) connection.sendError('PROTOCOL_ERROR', 'Failed to process request');
      }
    });

    connection.on('close', async () => {
      clearInterval(refillInterval);
      clearInterval(heartbeatInterval);
      clearTimeout(authTimeout);
      if (state.clientId) {
        await handlers.handleDisconnect(fastify, state.clientId);
      }
    });
  });
};