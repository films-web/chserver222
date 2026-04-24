// src/utils/wsInterceptor.js
function attachWsInterceptor(fastify, connection, clientId) {
    // Robust check for the socket object
    const socket = connection.socket || connection; 
    
    if (!socket || typeof socket.send !== 'function') {
        fastify.log.error(`[WS Interceptor] Failed to attach: socket.send is not a function`);
        return;
    }

    const originalSend = socket.send.bind(socket);

    connection.sendSuccess = (action, data = null) => {
        const response = {
            action: action,
            status: 'success',
            data: data
        };
        originalSend(JSON.stringify(response));
    };

    connection.sendError = (action, message) => {
        if (clientId) {
            fastify.log.error(`[WS Error - Client ${clientId}] Action: ${action} | ${message}`);
        } else {
            fastify.log.error(`[WS Error - Unauthenticated] Action: ${action} | ${message}`);
        }
        
        const response = {
            action: action,
            status: 'error',
            message: message || 'Internal Server Error'
        };
        originalSend(JSON.stringify(response));
    };

    connection.sendRawJSON = (payload) => {
        originalSend(JSON.stringify(payload));
    };
}

module.exports = attachWsInterceptor;