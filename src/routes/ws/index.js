const path = require('path');
const protobuf = require('protobufjs');
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

module.exports = async function (fastify, opts) {
  const root = await protobuf.load(path.join(__dirname, '../../../proto/message.proto'));
  const C2SMessage = root.lookupType("CheatHaram.C2S_Message");

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
      }
    };

    connection.on('message', async (message) => {
      try {
        if (message.length > 4096) {
          return connection.terminate();
        }

        if (tokens <= 0) return;
        tokens--;

        const encryptedStr = message.toString();

        const decryptedBuffer = decrypt(encryptedStr);
        if (!decryptedBuffer) {
          fastify.log.warn(`Failed to decrypt message from ${req.ip}`);
          return;
        }

        const decoded = C2SMessage.decode(decryptedBuffer);
        const payload = C2SMessage.toObject(decoded, { enums: String });

        if (!payload || !payload.action) return;

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