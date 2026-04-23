function attachWsInterceptor(fastify, connection, clientId) {
    const originalSend = connection.socket.send.bind(connection.socket);

    connection.sendSuccess = (action, data = null) => {
        const response = { action: action, status: 'success', data: data };
        fastify.log.info(`[WS SEND -> Client ${clientId || 'Unauthed'}] Action: ${action} | Data: ${JSON.stringify(data)}`);
        originalSend(JSON.stringify(response));
    };

    connection.sendError = (action, message) => {
        fastify.log.error(`[WS ERROR -> Client ${clientId || 'Unauthed'}] Action: ${action} | ${message}`);
        const response = { action: action, status: 'error', message: message || 'Internal Server Error' };
        originalSend(JSON.stringify(response));
    };

    connection.sendRawJSON = (payload) => {
        fastify.log.info(`[WS RAW -> Client ${clientId || 'Unauthed'}] Payload: ${JSON.stringify(payload)}`);
        originalSend(JSON.stringify(payload));
    };
}

module.exports = attachWsInterceptor;