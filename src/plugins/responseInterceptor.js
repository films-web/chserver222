const fp = require('fastify-plugin');

module.exports = fp(async function (fastify, opts) {
    fastify.addHook('preSerialization', async (request, reply, payload) => {
        if (payload && payload.status) {
            return payload;
        }

        return {
            status: 'success',
            data: payload
        };
    });

    fastify.setErrorHandler((error, request, reply) => {
        fastify.log.error(error);

        reply.status(error.statusCode || 500).send({
            status: 'error',
            message: error.message || 'Internal Server Error',
            data: null
        });
    });

});