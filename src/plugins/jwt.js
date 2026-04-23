const fp = require('fastify-plugin');

module.exports = fp(async function (fastify, opts) {
  fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'SuperSecretJWTKeyForDashboard123!'
  });

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401);
      throw new Error('Unauthorized: Invalid or missing token');
    }
  });
});