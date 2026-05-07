const { logEvent } = require('../../../services/clientService');

module.exports = async function handleLogEvent(fastify, socket, currentClientId, payload) {
    if (!currentClientId) return;

    try {
        const logMessage = payload.log_message || payload.logMessage;

        if (!logMessage) {
            return; // Ignore empty logs
        }

        await logEvent(fastify.db, currentClientId, logMessage);

        fastify.log.info(`[Log] Client ${currentClientId}: ${logMessage}`);

    } catch (err) {
        fastify.log.error(`Log event error for client ${currentClientId}: ${err.stack}`);
    }
};
