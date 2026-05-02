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
      return null;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(AES_KEY), iv);
    
    const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    return Buffer.concat([iv, ciphertext]); // Return raw Buffer
  } catch (err) {
    console.error('[SECURITY ERROR] Encryption failed:', err.message);
    return null;
  }
}

function decrypt(payload) {
  try {
    if (!AES_KEY || AES_KEY.length !== 32) {
      console.error('[SECURITY ERROR] AES_ENCRYPTION_KEY is missing or not 32 bytes in .env!');
      return null;
    }

    // Handle both Buffer (binary frame) and String (legacy/base64)
    let rawData;
    if (Buffer.isBuffer(payload)) {
      rawData = payload;
    } else {
      const cleanStr = payload.replace(/[^A-Za-z0-9+/=]/g, "");
      rawData = Buffer.from(cleanStr, 'base64');
    }
    
    if (rawData.length <= 16) {
      return null;
    }

    const iv = rawData.slice(0, 16);
    const ciphertext = rawData.slice(16);

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(AES_KEY), iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    return null;
  }
}

module.exports = { isValidSignature, encrypt, decrypt };