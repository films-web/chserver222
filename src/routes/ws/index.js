const { C2SMessage } = require('../../utils/protoloader');
const { decrypt } = require('../../utils/security');
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
const handleTakeFairshot = require('./handlers/takeFairshot');

module.exports = async function (fastify, opts) {
  fastify.get('/connect', { websocket: true }, (connection, req) => {
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
      if (!isAuthed && connection && connection.terminate) {
        connection.terminate();
      }
    }, 10000);

    const handlers = {
      AUTH_REQUEST: async (payload) => {
        currentClientId = await handleAuth(fastify, connection, payload); 
        if (currentClientId) {
          isAuthed = true;
          connection.clientId = String(currentClientId); 
          clearTimeout(authTimeout);
          attachWsInterceptor(fastify, connection, currentClientId);
        }
      },
      HEARTBEAT: async () => {
        if (!isAuthed) return;
        lastHeartbeat = Date.now();
        await handleHeartbeat(fastify, connection, currentClientId);
      },
      UPDATE_PLAYER_STATE: async (payload) => {
        if (!isAuthed) return;
        await handleUpdateState(fastify, connection, currentClientId, payload);
      },
      PK3_WHITELIST_REQ: async () => {
        if (!isAuthed) return;
        await handleRequestWhitelist(fastify, connection, currentClientId);
      },
      PAYLOAD_REQ: async () => {
        if (!isAuthed) return;
        await handleRequestPayload(fastify, connection, currentClientId);
      },
      PLAYER_LIST_REQ: async () => {
        if (!isAuthed) return;
        await handleRequestAcStatus(fastify, connection, currentClientId);
      },
      GET_GUID_REQ: async (payload) => {
        if (!isAuthed) return;
        await handleRequestGuid(fastify, connection, currentClientId, payload);
      },
      REQUEST_FAIRSHOT: async (payload) => {
        if (!isAuthed) return;
        await handleRequestFairshot(fastify, connection, currentClientId, payload);
      },
      TAKE_FAIRSHOT: async (payload) => {
        if (!isAuthed) return;
        await handleTakeFairshot(fastify, connection, currentClientId, payload);
      }
    };

    connection.on('message', async (message) => {
      try {
        if (message.length > 1024 * 1024) { // 1MB limit for Fairshots
          fastify.log.warn(`[WS] Client ${currentClientId} sent oversized message: ${message.length} bytes`);
          return connection.terminate();
        }

        if (tokens <= 0) return;
        tokens--;

        const decryptedBuffer = decrypt(message.toString());
        if (!decryptedBuffer) return;

        const decoded = C2SMessage.decode(decryptedBuffer);
        const payload = C2SMessage.toObject(decoded, { 
            enums: String, 
            defaults: true
        });

        if (!payload || !payload.action) return;

        // -- GLOBAL ANTI-REPLAY MECHANISM --
        const now = Date.now();
        const msgTime = Number(payload.timestamp);
        if (Math.abs(now - msgTime) > 30000) {
            fastify.log.warn(`[Security] Replay attempt detected (Timestamp out of sync): ${currentClientId}`);
            return;
        }

        if (payload.message_id) {
            const replayKey = `msg_replay:${payload.message_id}`;
            const isDuplicate = await fastify.redis.set(replayKey, '1', 'EX', 60, 'NX');
            if (!isDuplicate) {
                fastify.log.warn(`[Security] Duplicate message detected: ${payload.message_id} from ${currentClientId}`);
                return;
            }
        }

        const handler = handlers[payload.action];
        if (handler) {
          await handler(payload);
        } else {
          connection.sendError(payload.action, `No handler registered for ${payload.action}`);
        }

      } catch (err) {
        fastify.log.error(`WS Protocol Error: ${err.message}`);
        connection.sendError('UNKNOWN', 'Protocol processing error');
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
      await handleDisconnect(fastify, currentClientId);
    });
  });
};