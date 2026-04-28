require('dotenv').config();
const crypto = require('crypto');

const CLIENT_SECRET = process.env.CLIENT_SECRET;
const AES_KEY = process.env.AES_ENCRYPTION_KEY;

function isValidSignature(hwid, signature) {
  const expectedSignature = crypto.createHmac('sha256', CLIENT_SECRET)
    .update(hwid)
    .digest('hex');
  return signature === expectedSignature;
}

function encrypt(plaintextBuffer) {
  try {
    if (!AES_KEY || AES_KEY.length !== 32) {
      console.error('[SECURITY ERROR] Server AES Key is invalid or missing.');
      return '';
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(AES_KEY), iv);
    
    const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const finalPayload = Buffer.concat([iv, ciphertext]);
    
    return finalPayload.toString('base64');
  } catch (err) {
    console.error('[SECURITY ERROR] Encryption failed:', err.message);
    return '';
  }
}

function decrypt(base64Payload) {
  try {
    if (!AES_KEY || AES_KEY.length !== 32) {
      console.error('[SECURITY ERROR] AES_ENCRYPTION_KEY is missing or not 32 bytes in .env!');
      return null;
    }

    const cleanStr = base64Payload.replace(/[^A-Za-z0-9+/=]/g, "");
    const rawData = Buffer.from(cleanStr, 'base64');
    
    if (rawData.length <= 16) {
      console.error(`[SECURITY ERROR] Payload too short (${rawData.length} bytes). Is the loader sending JSON instead of AES?`);
      return null;
    }

    const iv = rawData.slice(0, 16);
    const ciphertext = rawData.slice(16);

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(AES_KEY), iv);
    
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  } catch (err) {
    console.error('[SECURITY ERROR] Decryption failed:', err.message);
    return null;
  }
}

module.exports = { isValidSignature, encrypt, decrypt };