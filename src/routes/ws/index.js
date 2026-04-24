module.exports = async function (fastify, opts) {

  console.log("🔥 WS ROUTES MODULE LOADED");

  fastify.get('/connect', { websocket: true }, (connection, req) => {

    console.log("🟢 WS CONNECTED");

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
        console.log("🔴 AUTH TIMEOUT - closing socket");

        if (connection?.socket) connection.socket.terminate();
        else connection?.terminate?.();
      }
    }, 10000);

    const handlers = {
      auth: async (payload) => {
        console.log("📥 AUTH RECEIVED:", payload);

        currentClientId = await handleAuth(fastify, connection, payload);

        console.log("🆔 CLIENT ID:", currentClientId);

        if (currentClientId) {
          isAuthed = true;
          clearTimeout(authTimeout);

          console.log("✅ AUTH SUCCESS");

          attachWsInterceptor(fastify, connection, currentClientId);
        }
      },

      heartbeat: async () => {
        if (!isAuthed) return;

        lastHeartbeat = Date.now();
        console.log("💓 HEARTBEAT");

        await handleHeartbeat(fastify, connection, currentClientId);
      },

      update_state: async (payload) => {
        if (!isAuthed) return;

        console.log("📊 UPDATE STATE");
        await handleUpdateState(fastify, connection, currentClientId, payload);
      },

      pk3_whitelist: async () => {
        if (!isAuthed) return;

        console.log("📜 WHITELIST REQUEST");
        await handleRequestWhitelist(fastify, connection, currentClientId);
      },

      payload: async () => {
        if (!isAuthed) return;

        console.log("📦 PAYLOAD REQUEST");
        await handleRequestPayload(fastify, connection, currentClientId);
      },

      get_player_list: async () => {
        if (!isAuthed) return;

        console.log("👥 PLAYER LIST REQUEST");
        await handleRequestAcStatus(fastify, connection, currentClientId);
      },

      request_guid: async (payload) => {
        if (!isAuthed) return;

        console.log("🪪 GUID REQUEST");
        await handleRequestGuid(fastify, connection, currentClientId, payload);
      },

      request_fairshot: async (payload) => {
        if (!isAuthed) return;

        console.log("🎯 FAIRSHOT REQUEST");
        await handleRequestFairshot(fastify, connection, currentClientId, payload);
      }
    };

    connection.socket.on('message', async (message) => {
      try {

        console.log("📩 RAW MESSAGE:", message.toString());

        if (message.length > 2024) {
          console.log("🚫 MESSAGE TOO LARGE - TERMINATING");
          return connection.socket.terminate();
        }

        if (tokens <= 0) {
          console.log("⚠️ RATE LIMIT HIT");
          fastify.log.warn(`Rate limit exceeded for client: ${currentClientId}`);
          return;
        }

        tokens--;

        let payload;
        try {
          payload = JSON.parse(message.toString());
        } catch (e) {
          console.log("❌ INVALID JSON:", message.toString());
          return;
        }

        if (!payload || typeof payload.action !== 'string') {
          console.log("❌ INVALID PAYLOAD SHAPE:", payload);
          return;
        }

        console.log("➡️ ACTION:", payload.action);

        const handler = handlers[payload.action];

        if (handler) {
          await handler(payload);
        } else {
          console.log("❓ UNKNOWN ACTION:", payload.action);
          connection.sendError(payload.action, `Unknown WS action: ${payload.action}`);
        }

      } catch (err) {
        console.log("💥 MESSAGE HANDLER ERROR:", err);
        connection.sendError('unknown', 'Internal Server Error during message processing.');
      }
    });

    const heartbeatInterval = setInterval(() => {
      if (Date.now() - lastHeartbeat > 60000) {
        console.log("💔 HEARTBEAT TIMEOUT - TERMINATING");
        connection.socket.terminate();
      }
    }, 5000);

    connection.socket.on('close', async (code, reason) => {
      console.log(`🔌 WS CLOSED | code=${code} reason=${reason?.toString()}`);

      clearInterval(refillInterval);
      clearInterval(heartbeatInterval);
      clearTimeout(authTimeout);

      await handleDisconnect(fastify, currentClientId);
    });

    connection.socket.on('error', (err) => {
      console.log("💥 WS ERROR:", err);
    });

  });
};