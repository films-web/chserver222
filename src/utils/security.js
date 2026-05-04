const crypto = require('crypto');
const { promisify } = require('util');

class SecurityUtils {
    // Matches the C++ AesTransportKey
    static AES_KEY = Buffer.from(process.env.AES_TRANSPORT_KEY, 'hex'); 
    static REPLAY_WINDOW_SECONDS = 30;

    /**
     * Decrypts incoming packets from the loader
     */
    static decrypt(encryptedBase64) {
        try {
            const encryptedData = Buffer.from(encryptedBase64, 'base64');
            // Assuming AES-256-CBC with a fixed IV for transport or appended IV
            const iv = encryptedData.slice(0, 16);
            const ciphertext = encryptedData.slice(16);
            
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.AES_KEY, iv);
            let decrypted = decipher.update(ciphertext);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted;
        } catch (err) {
            return null;
        }
    }

    /**
     * Anti-Replay Attack Logic
     * 1. Check if timestamp is within +/- 30s window
     * 2. Check Redis to ensure message_id hasn't been used
     */
    static async isMessageValid(redis, messageId, clientTimestamp) {
        const now = Math.floor(Date.now() / 1000);
        
        // 1. Timestamp Verification
        const diff = Math.abs(now - clientTimestamp);
        if (diff > this.REPLAY_WINDOW_SECONDS) {
            return { valid: false, reason: 'Timestamp outside allowed window (Clock Drift or Replay)' };
        }

        // 2. Message ID Uniqueness (Idempotency check)
        // SETNX returns 1 if the key was set (first time seeing it)
        const cacheKey = `msg_id:${messageId}`;
        const isNew = await redis.set(cacheKey, '1', 'EX', this.REPLAY_WINDOW_SECONDS * 2, 'NX');
        
        if (!isNew) {
            return { valid: false, reason: 'Duplicate message_id detected (Replay Attack)' };
        }

        return { valid: true };
    }
}

module.exports = SecurityUtils;