const protobuf = require('protobufjs');
const path = require('path');

let C2SMessage, S2CMessage;

try {
    const protoPath = path.join(__dirname, 'proto/messages.proto');
    const root = protobuf.loadSync(protoPath);
    
    C2SMessage = root.lookupType("CheatHaram.C2S_Message");
    S2CMessage = root.lookupType("CheatHaram.S2C_Message");

    console.log('[PROTO] Schema loaded from messages.proto');
} catch (err) {
    console.error('[PROTO ERROR] Failed to load messages.proto:', err.message);
    process.exit(1);
}

module.exports = { C2SMessage, S2CMessage };