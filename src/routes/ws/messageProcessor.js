const SecurityUtils = require('./security');
const { C2SMessage } = require('./protoloader');

async function processIncomingMessage(fastify, message, currentClientId) {
  const decryptedBuffer = SecurityUtils.decrypt(message.toString('utf8').trim());
  if (!decryptedBuffer) throw new Error('Decryption failed');

  const decoded = C2SMessage.decode(decryptedBuffer);
  const payload = C2SMessage.toObject(decoded, { 
    enums: String, 
    defaults: true,
    longs: String, 
    keepCase: true 
  });

  if (!payload || !payload.action) throw new Error('Missing action');

  const msgId = payload.message_id || payload.messageId;
  const clientTime = parseInt(payload.timestamp || payload.timeStamp, 10);

  const security = await SecurityUtils.isMessageValid(fastify.redis, msgId, clientTime);
  if (!security.valid) throw new Error(`Security Rejected: ${security.reason}`);

  return payload;
}

module.exports = processIncomingMessage;