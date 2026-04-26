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
  fastify.get('/connect', { websocket: true }, (connection, req) => {
    if (!global.activeSockets) {
      global.activeSockets = new Map();
    }

    let currentClientId = null;
    let isAuthed = false;

    attachWsInterceptor(fastify, connection, currentClientId);

    let tokens = 50;
    const refillRate = 50;

    const refillInterval = setInterval(() => {
      tokens = Math.min(tokens + refillRate, 50);
    }, 1000);

    let lastHeartbeat = Date.now();

    const authTimeout = setTimeout(() => {
      if (!isAuthed) {
        if (connection && connection.terminate) {
          connection.terminate();
        }
      }
    }, 10000);

    const handlers = {
      auth: async (payload) => {
        currentClientId = await handleAuth(fastify, connection, payload);
        if (currentClientId) {
          isAuthed = true;
          clearTimeout(authTimeout);
          global.activeSockets.set(String(currentClientId), connection);
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
        await handleUpdateState(fastify, connection, currentClientId, payload)
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

    connection.on('message', async (message) => {
      try {
        if (message.length > 2048) {
          return connection.terminate();
        }

        if (tokens <= 0) {
          fastify.log.warn(`Rate limit exceeded for client: ${currentClientId}`);
          return;
        }
        tokens--;

        let payload;
        try {
          payload = JSON.parse(message.toString());
        } catch {
          return;
        }

        if (!payload || typeof payload.action !== 'string') {
          return;
        }

        const handler = handlers[payload.action];
        if (handler) {
          fastify.log.info(`Received WS action: ${payload.action} from client ${currentClientId}`);
          await handler(payload);
        } else {
          connection.sendError(payload.action, `Unknown WS action: ${payload.action}`);
        }

      } catch (err) {
        connection.sendError('unknown', 'Internal Server Error during message processing.');
      }
    });

    const heartbeatInterval = setInterval(() => {
      const timeoutMs = parseInt(process.env.HEARTBEAT_TIMEOUT_SEC || '60', 10) * 1000;
      if (Date.now() - lastHeartbeat > timeoutMs) {
        connection.terminate();
      }
    }, 5000);

    connection.on('close', async () => {
      clearInterval(refillInterval);
      clearInterval(heartbeatInterval);
      clearTimeout(authTimeout);
      if (currentClientId) {
        global.activeSockets.delete(String(currentClientId));
      }

      await handleDisconnect(fastify, currentClientId);
    });
  });
};