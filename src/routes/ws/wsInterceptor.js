const { S2CMessage } = require('./protoloader');
const SecurityUtils = require('./security');

function attachWsInterceptor(fastify, connection, clientId) {
    const originalSend = connection.send.bind(connection);

    connection.sendSuccess = connection.socket.sendSuccess = (action, data = {}) => {
        if (!S2CMessage) return;

        const payload = { 
            action: action, 
            success: true,
            ...data 
        };

        const message = S2CMessage.fromObject(payload);
        const protoBuffer = S2CMessage.encode(message).finish();
        const encryptedBase64 = SecurityUtils.encrypt(Buffer.from(protoBuffer));
        if (encryptedBase64) originalSend(encryptedBase64);
    };

    connection.sendError = connection.socket.sendError = (action, messageStr) => {
        if (!S2CMessage) return;

        fastify.log.error(`[WS Error] ${clientId || 'Unauthed'} | ${action}: ${messageStr}`);
        
        const payload = { 
            action: action, 
            success: false, 
            message: messageStr || 'Internal Server Error' 
        };

        const message = S2CMessage.fromObject(payload);
        const protoBuffer = S2CMessage.encode(message).finish();
        
        const encryptedBase64 = SecurityUtils.encrypt(Buffer.from(protoBuffer));
        if (encryptedBase64) originalSend(encryptedBase64);
    };

    connection.sendRawJSON = (payload) => {
        originalSend(JSON.stringify(payload));
    };
}

module.exports = attachWsInterceptor;