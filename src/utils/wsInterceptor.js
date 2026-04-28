const protobuf = require('protobufjs');
const path = require('path');
const { encrypt } = require('./security'); //

let S2CMessage;

// Load the proto definition for server-to-client messages
protobuf.load(path.join(__dirname, '../../../proto/messages.proto'), (err, root) => {
    if (err) {
        console.error("Failed to load Protobuf schema:", err);
        return;
    }
    S2CMessage = root.lookupType("CheatHaram.S2C_Message");
});

function attachWsInterceptor(fastify, connection, clientId) {
    const originalSend = connection.send.bind(connection);

    /**
     * Encodes to Protobuf -> Encrypts with Random IV -> Sends Base64 String
     * This matches C++ SecureProtocol::Unpack exactly.
     */
    connection.sendSuccess = (action, data = {}) => {
        if (!S2CMessage) return;

        const payload = {
            action: action, // Ensure this matches the ActionType enum name or value
            success: true,
            ...data
        };

        // 1. Encode the message into a binary Protobuf buffer
        const protoBuffer = S2CMessage.encode(S2CMessage.create(payload)).finish();

        // 2. Encrypt the buffer (generates random IV + prepends it + Base64 encodes)
        const encryptedBase64 = encrypt(protoBuffer); //

        // 3. Send the final secure string to the loader
        originalSend(encryptedBase64);
    };

    connection.sendError = (action, message) => {
        if (!S2CMessage) return;

        if (clientId) {
            fastify.log.error(`[WS Error - Client ${clientId}] Action: ${action} | ${message}`);
        } else {
            fastify.log.error(`[WS Error - Unauthenticated] Action: ${action} | ${message}`);
        }
        
        const payload = {
            action: action,
            success: false,
            message: message || 'Internal Server Error'
        };

        const protoBuffer = S2CMessage.encode(S2CMessage.create(payload)).finish();
        const encryptedBase64 = encrypt(protoBuffer); //

        originalSend(encryptedBase64);
    };

    connection.sendRawJSON = (payload) => {
        originalSend(JSON.stringify(payload));
    };
}

module.exports = attachWsInterceptor;