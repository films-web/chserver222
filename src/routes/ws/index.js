const attachWsInterceptor = require('../../utils/wsInterceptor');
const handleAuth = require('./handlers/auth');
const handleHeartbeat = require('./handlers/heartbeat');
const handleUpdateState = require('./handlers/updateState');
const handleDisconnect = require('./handlers/disconnect');
const handleRequestWhitelist = require('./handlers/requestWhitelist');
const handleRequestPayload = require('./handlers/requestPayload');
const handleRequestAcStatus = require('./handlers/requestAcStatus');
const handleRequestGuid = require('./handlers/requestGuid');
const handleRequestFairshot = require('./handlers/requestFairshot');

module.exports = async function (fastify, opts) {
  // In Fastify v11, 'connection' is a SocketStream object
  fastify.get('/connect', { websocket: true }, (connection, req) => {
    
    // Safety check: extract the raw websocket
    const socket = connection.socket;
    if (!socket) {
      fastify.log.error("WebSocket connection failed: No socket found in stream.");
      return connection.destroy();
    }

    let currentClientId = null;
    let isAuthed = false;

    // Attach our helpers to the SocketStream so handlers can use connection.sendSuccess()
    attachWsInterceptor(fastify, connection, currentClientId);

    let tokens = 100; // Increased burst
    const refillRate = 50;
    const refillInterval = setInterval(() => {
      tokens = Math.min(tokens + refillRate, 100);
    }, 1000);

    let lastHeartbeat = Date.now();

    const authTimeout = setTimeout(() => {
      if (!isAuthed) {
        socket.terminate();
      }
    }, 10000);

    const handlers = {
      auth: async (payload) => {
        currentClientId = await handleAuth(fastify, connection, payload);
        if (currentClientId) {
          isAuthed = true;
          clearTimeout(authTimeout);
          // Re-attach with the actual ClientID for better logging
          attachWsInterceptor(fastify, connection, currentClientId);
        }
      },
      heartbeat: async () => {
        if (!isAuthed) return;
        lastHeartbeat = Date.now();
        await handleHeartbeat(fastify, connection, currentClientId);
      },
      update_state: async (payload) => {
        if (!isAuthed) return;
        await handleUpdateState(fastify, connection, currentClientId, payload);
      },
      pk3_whitelist: async () => {
        if (!isAuthed) return;
        await handleRequestWhitelist(fastify, connection, currentClientId);
      },
      payload: async () => {
        if (!isAuthed) return;
        await handleRequestPayload(fastify, connection, currentClientId);
      },
      get_player_list: async () => {
        if (!isAuthed) return;
        await handleRequestAcStatus(fastify, connection, currentClientId);
      },
      request_guid: async (payload) => {
        if (!isAuthed) return;
        await handleRequestGuid(fastify, connection, currentClientId, payload);
      },
      request_fairshot: async (payload) => {
        if (!isAuthed) return;
        await handleRequestFairshot(fastify, connection, currentClientId, payload);
      }
    };

    // Use 'socket' directly for the event listener
    socket.on('message', async (message) => {
      try {
        if (message.length > 4096) return socket.terminate();

        if (tokens <= 0) return;
        tokens--;

        let payload;
        try {
          payload = JSON.parse(message.toString());
        } catch { return; }

        if (!payload || typeof payload.action !== 'string') return;

        const handler = handlers[payload.action];
        if (handler) {
          await handler(payload);
        } else {
          connection.sendError(payload.action, `Unknown action: ${payload.action}`);
        }
      } catch (err) {
        fastify.log.error(err);
        if (connection.sendError) connection.sendError('unknown', 'Internal error');
      }
    });

    const heartbeatInterval = setInterval(() => {
      if (Date.now() - lastHeartbeat > 60000) {
        socket.terminate();
      }
    }, 5000);

    socket.on('close', async () => {
      clearInterval(refillInterval);
      clearInterval(heartbeatInterval);
      clearTimeout(authTimeout);
      if (currentClientId) await handleDisconnect(fastify, currentClientId);
    });
  });
};