const fp = require('fastify-plugin');
const { Pool } = require('pg');

module.exports = fp(async function (fastify, opts) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

  fastify.decorate('db', pool);

  fastify.addHook('onClose', async (instance, done) => {
    fastify.log.info('Closing PostgreSQL pool...');
    await pool.end();
    done();
  });
});