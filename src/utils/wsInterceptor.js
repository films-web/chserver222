const protobuf = require('protobufjs');
const path = require('path');
const { encrypt } = require('./security');

const root = protobuf.loadSync(path.join(__dirname, '/../../proto/message.proto'), { keepCase: true } );
const S2CMessage = root.lookupType("CheatHaram.S2C_Message");

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

        if (clientId) {
            fastify.log.error(`[WS Error - Client ${clientId}] Action: ${action} | ${messageStr}`);
        } else {
            fastify.log.error(`[WS Error - Unauthenticated] Action: ${action} | ${messageStr}`);
        }
        
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