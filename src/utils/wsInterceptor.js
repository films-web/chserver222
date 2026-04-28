const { S2CMessage } = require('./protoLoader');
const { encrypt } = require('./security');

function attachWsInterceptor(fastify, connection, clientId) {
    const originalSend = connection.send.bind(connection);
    connection.sendSuccess = (action, data = {}) => {
        if (!S2CMessage) return;
        const payload = { action: action, success: true, ...data };
        const message = S2CMessage.fromObject(payload);
        const protoBuffer = S2CMessage.encode(message).finish();
        const encryptedBase64 = encrypt(Buffer.from(protoBuffer));
        originalSend(encryptedBase64);
    };

    connection.sendError = (action, messageStr) => {
        if (!S2CMessage) return;

        fastify.log.error(`[WS Error] ${clientId || 'Unauthed'} | ${action}: ${messageStr}`);
        
        const payload = { action: action, success: false, message: messageStr || 'Internal Server Error' };
        const message = S2CMessage.fromObject(payload);
        const protoBuffer = S2CMessage.encode(message).finish();
        
        const encryptedBase64 = encrypt(Buffer.from(protoBuffer));
        originalSend(encryptedBase64);
    };

    connection.sendRawJSON = (payload) => {
        originalSend(JSON.stringify(payload));
    };
}

module.exports = attachWsInterceptor;