const protobuf = require('protobufjs');
const path = require('path');
const protoJSON = require('../../proto/message.json');

let C2SMessage, S2CMessage;

try {
    const root = protobuf.Root.fromJSON(protoJSON);
    C2SMessage = root.lookupType("CheatHaram.C2S_Message");
    S2CMessage = root.lookupType("CheatHaram.S2C_Message");

    console.log('[PROTO] Schema loaded from static JSON.');
} catch (err) {
    console.error('[PROTO ERROR] Failed to load JSON schema:', err.message);
    process.exit(1);
}

module.exports = { C2SMessage, S2CMessage };