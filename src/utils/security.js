require('dotenv').config();
const { createHmac } = require('crypto');

const CLIENT_SECRET = process.env.CLIENT_SECRET || 'MySuperSecretAntiCheatKey123!';

function isValidSignature(hwid, signature) {
  const expectedSignature = createHmac('sha256', CLIENT_SECRET)
    .update(hwid)
    .digest('hex');
  return signature === expectedSignature;
}

module.exports = { isValidSignature };