const { C2SMessage } = require('../../utils/protoloader');
const SecurityUtils = require('../../utils/security');
const attachWsInterceptor = require('../../utils/wsInterceptor');

const handlers = require('./handlers');
const processIncoming = require('./messageProcessor');

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
        currentClientId = await handlers.handleAuth(fastify, connection, payload); 
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
        await handlers.handleHeartbeat(fastify, connection, currentClientId);
      },
      UPDATE_PLAYER_STATE: async (payload) => {
        if (!isAuthed) return;
        await handlers.handleUpdateState(fastify, connection, currentClientId, payload);
      },
      PK3_WHITELIST_REQ: async () => {
        if (!isAuthed) return;
        await handlers.handleRequestWhitelist(fastify, connection, currentClientId);
      },
      PAYLOAD_REQ: async () => {
        if (!isAuthed) return;
        await handlers.handleRequestPayload(fastify, connection, currentClientId);
      },
      PLAYER_LIST_REQ: async () => {
        if (!isAuthed) return;
        await handlers.handleRequestAcStatus(fastify, connection, currentClientId);
      },
      GET_GUID_REQ: async (payload) => {
        if (!isAuthed) return;
        await handlers.handleRequestGuid(fastify, connection, currentClientId, payload);
      },
      REQUEST_FAIRSHOT: async (payload) => {
        if (!isAuthed) return;
        await handlers.handleRequestFairshot(fastify, connection, currentClientId, payload);
      },
      TAKE_FAIRSHOT: async (payload) => {
        if (!isAuthed) return;
        await handlers.handleTakeFairshot(fastify, connection, currentClientId, payload);
      }
    };

    connection.on('message', async (message) => {
      try {
        if (message.length > 1024 * 1024) { // 1MB limit for Fairshots
          fastify.log.warn(`[WS] Client ${currentClientId} sent oversized message: ${message.length} bytes`);
          return connection.terminate();
        }

        if (tokens <= 0) {
            fastify.log.warn(`[WS] Client rate limited.`);
            return;
        }
        tokens--;

        // 1. Base64 Decrypt (using trim to strip WS padding/newlines)
        // Fix applied: Using SecurityUtils directly to prevent 'this' context loss
        const decryptedBuffer = SecurityUtils.decrypt(message.toString('utf8').trim());
        if (!decryptedBuffer) {
            fastify.log.error(`[WS] Failed to decrypt message from ${currentClientId || 'Unknown IP'}`);
            return;
        }

        // 2. Decode Protobuf
        let decoded;
        try {
            decoded = C2SMessage.decode(decryptedBuffer);
        } catch (err) {
            fastify.log.error(`[WS] Protobuf Decode Error: ${err.message}`);
            return;
        }

        const payload = C2SMessage.toObject(decoded, { 
            enums: String, 
            defaults: true,
            longs: String,  // Prevents large numbers from becoming JS objects
            keepCase: true  // CRITICAL: Keeps message_id as message_id instead of messageId
        });

        if (!payload || !payload.action) {
            fastify.log.error(`[WS] Action missing in payload: ${JSON.stringify(payload)}`);
            return;
        }

        fastify.log.info(`[WS] Received action: ${payload.action} from client ID: ${currentClientId}`);

        const msgId = payload.message_id || payload.messageId;
        const rawTs = payload.timestamp || payload.timeStamp;
        
        const clientTime = parseInt(rawTs, 10);

        if (!msgId || isNaN(clientTime)) {
            fastify.log.warn(`[Security] Metadata extraction failed! msgId: ${msgId}, rawTs: ${rawTs}`);
            fastify.log.info(`[WS] RAW PAYLOAD DUMP: ${JSON.stringify(payload)}`);
            return;
        }

        const security = await SecurityUtils.isMessageValid(
            fastify.redis, 
            msgId, 
            clientTime
        );

        if (!security.valid) {
            fastify.log.warn(`[Security] WS Message Rejected: ${security.reason} | Client: ${currentClientId}`);
            return;
        }

        // 4. Route to Handler
        const handler = handlers[payload.action];
        if (handler) {
          await handler(payload);
        } else {
          fastify.log.warn(`[WS] No handler registered for ${payload.action}`);
          if (connection.sendError) connection.sendError(payload.action, `No handler registered`);
        }

      } catch (err) {
        fastify.log.error(`WS Protocol Error: ${err.stack}`);
        if (connection.sendError) connection.sendError('UNKNOWN', 'Protocol processing error');
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
      await handlers.handleDisconnect(fastify, currentClientId);
    });
  });
};