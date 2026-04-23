const handleAuth = require('./handlers/auth');
const handleHeartbeat = require('./handlers/heartbeat');
const handleUpdateState = require('./handlers/updateState');
const handleDisconnect = require('./handlers/disconnect');
const handleRequestWhitelist = require('./handlers/requestWhitelist');
const handleRequestPayload = require('./handlers/requestPayload');
const handleRequestAcStatus = require('./handlers/requestAcStatus');

module.exports = async function (fastify, opts) {
  // 1. Rename 'connection' to 'rawSocket' in the parameters
  fastify.get('/connect', { websocket: true }, (rawSocket, req) => {
    
    // 2. Recreate the old wrapper so the rest of your code works perfectly!
    const connection = { socket: rawSocket };

    let currentClientId = null;
    let isAuthed = false;

    // 🔒 token bucket (better than simple counter)
    let tokens = 50;
    const refillRate = 50; // per second

    const refillInterval = setInterval(() => {
      tokens = Math.min(tokens + refillRate, 50);
    }, 1000);

    // ❤️ heartbeat tracking
    let lastHeartbeat = Date.now();

    // ⏳ auth timeout (10s)
    const authTimeout = setTimeout(() => {
      if (!isAuthed) {
        if (connection && connection.socket) {
          connection.socket.terminate();
        } else if (connection && connection.terminate) {
          connection.terminate(); // Fallback for newer Fastify versions
        }
      }
    }, 10000);

    const handlers = {
      auth: async (payload) => {
        currentClientId = await handleAuth(fastify, connection, payload);
        if (currentClientId) {
          isAuthed = true;
          clearTimeout(authTimeout);
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

      ac_status: async () => {
        if (!isAuthed) return;
        await handleRequestAcStatus(fastify, connection, currentClientId);
      }
    };

    connection.socket.on('message', async (message) => {
      try {
        // 🚫 size limit
        if (message.length > 1024) {
          return connection.socket.terminate();
        }

        // 🚫 token bucket limiter
        if (tokens <= 0) {
          return connection.socket.terminate();
        }
        tokens--;

        let payload;
        try {
          payload = JSON.parse(message.toString());
        } catch {
          return;
        }

        // 🚫 basic validation
        if (!payload || typeof payload.action !== 'string') {
          return;
        }

        const handler = handlers[payload.action];
        if (handler) {
          await handler(payload);
        } else {
          fastify.log.warn(`Unknown WS action: ${payload.action}`);
        }

      } catch (err) {
        fastify.log.error('WS Message Error:', err.message);
      }
    });

    const heartbeatInterval = setInterval(() => {
      if (Date.now() - lastHeartbeat > 60000) {
        connection.socket.terminate();
      }
    }, 5000);

    connection.socket.on('close', async () => {
      clearInterval(refillInterval);
      clearInterval(heartbeatInterval);
      clearTimeout(authTimeout);

      await handleDisconnect(fastify, currentClientId);
    });
  });
};