const protobuf = require('protobufjs');
const path = require('path');
const fs = require('fs');

const protoPath = path.join(__dirname, '../../proto/message.proto');

let C2SMessage;
let S2CMessage;

try {
    const protoString = fs.readFileSync(protoPath, 'utf8');

    const root = new protobuf.Root();
    root.parse(protoString, { keepCase: true });

    C2SMessage = root.lookupType("CheatHaram.C2S_Message");
    S2CMessage = root.lookupType("CheatHaram.S2C_Message");

    console.log('[PROTO] Schema loaded successfully with keepCase: true');
} catch (err) {
    console.error('[PROTO ERROR] Failed to load/parse Protobuf schema:', err.message);
    process.exit(1);
}


module.exports = { C2SMessage, S2CMessage };