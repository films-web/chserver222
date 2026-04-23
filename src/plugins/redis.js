const fp = require('fastify-plugin');
const Redis = require('ioredis');

module.exports = fp(async function (fastify, opts) {
  const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async (instance, done) => {
    fastify.log.info('Closing Redis connection...');
    await redis.quit();
    done();
  });
});