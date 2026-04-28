require('dotenv').config();
const crypto = require('crypto');

const CLIENT_SECRET = process.env.CLIENT_SECRET;
const AES_KEY = process.env.AES_ENCRYPTION_KEY; // Must be 32 bytes

function isValidSignature(hwid, signature) {
  const expectedSignature = crypto.createHmac('sha256', CLIENT_SECRET)
    .update(hwid)
    .digest('hex');
  return signature === expectedSignature;
}

function encrypt(plaintextBuffer) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(AES_KEY), iv);
  
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.finish()]);
  const finalPayload = Buffer.concat([iv, ciphertext]);
  
  return finalPayload.toString('base64');
}

function decrypt(base64Payload) {
  try {
    const rawData = Buffer.from(base64Payload, 'base64');
    if (rawData.length <= 16) return null;

    const iv = rawData.slice(0, 16);
    const ciphertext = rawData.slice(16);

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(AES_KEY), iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.finish()]);
  } catch (err) {
    return null;
  }
}

module.exports = { isValidSignature, encrypt, decrypt };