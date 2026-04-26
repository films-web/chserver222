require('dotenv').config();
const Fastify = require('fastify');
const rateLimit = require('@fastify/rate-limit');

const apiServer = Fastify({ logger: true, trustProxy: true, bodyLimit: 10 * 1024 * 1024 });
const wsServer = Fastify({ logger: true, trustProxy: true });

const start = async () => {
  try {
    // ==========================================
    // API SERVER SETUP
    // ==========================================
    await apiServer.register(require('@fastify/cors'), {
      origin: [
        'https://ch-sof2.online',
        'https://www.ch-sof2.online',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    });

    await apiServer.register(require('./plugins/db'));
    await apiServer.register(require('./plugins/redis'));
    
    // JWT Plugin for Admin Dashboard
    await apiServer.register(require('./plugins/jwt'));

    // Multipart Plugin for File Uploads (Max 50MB)
    await apiServer.register(require('@fastify/multipart'), {
      limits: { fileSize: 50 * 1024 * 1024 }
    });

    await apiServer.register(rateLimit, {
      redis: apiServer.redis,
      max: 50,
      timeWindow: '1 minute',
      keyGenerator: (req) => {
        return req.headers['x-client-id'] || req.ip;
      }
    });

    await apiServer.register(require('./plugins/responseInterceptor'));
    await apiServer.register(require('./routes/api/index'));

    // ==========================================
    // WEBSOCKET SERVER SETUP
    // ==========================================
    await wsServer.register(require('@fastify/websocket'), {
      options: {
        // Increase to 15MB (Base64 is bulky)
        maxPayload: 15 * 1024 * 1024, 
        // CRITICAL: Disable this to fix "RSV2 and RSV3 must be clear"
        perMessageDeflate: false 
      }
    });
    await wsServer.register(require('./plugins/db'));
    await wsServer.register(require('./plugins/redis'));

    // Limits connection attempts (handshakes), not messages!
    await wsServer.register(rateLimit, {
      redis: wsServer.redis,
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip
    });

    await wsServer.register(require('./routes/ws/index'));

    // ==========================================
    // START LISTENERS
    // ==========================================
    const apiPort = process.env.API_PORT || 3000;
    const wsPort = process.env.WS_PORT || 3001;

    await apiServer.listen({ port: apiPort, host: '127.0.0.1' });
    await wsServer.listen({ port: wsPort, host: '127.0.0.1' });

    console.log(`🟢 REST API running on port ${apiPort}`);
    console.log(`🔵 WebSocket Server running on port ${wsPort}`);

  } catch (err) {
    console.error('Failed to start servers:', err);
    process.exit(1);
  }
};

start();