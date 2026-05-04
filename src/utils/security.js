const crypto = require('crypto');

class SecurityUtils {
    // Matches the C++ AesTransportKey
    static AES_KEY = (() => {
        const raw = process.env.AES_ENCRYPTION_KEY || 'Ch34tH4r4m_S3cr3t_K3y_256B1t_!!!';
        const buf = Buffer.from(raw, 'utf8');
        if (buf.length === 32) return buf;
        
        // Pad or truncate to 32 bytes
        const finalBuf = Buffer.alloc(32, 0);
        buf.copy(finalBuf, 0, 0, Math.min(buf.length, 32));
        return finalBuf;
    })();

    static REPLAY_WINDOW_SECONDS = 30;

    /**
     * Encrypts outgoing packets to the loader
     */
    static encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            // FIX: Use SecurityUtils.AES_KEY instead of this.AES_KEY
            const cipher = crypto.createCipheriv('aes-256-cbc', SecurityUtils.AES_KEY, iv);
            let encrypted = cipher.update(data);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            // Format: IV (16 bytes) + Ciphertext
            const result = Buffer.concat([iv, encrypted]);
            return result.toString('base64');
        } catch (err) {
            console.error('[Security] Encryption failed:', err);
            return null;
        }
    }

    /**
     * Decrypts incoming packets from the loader
     */
    static decrypt(encryptedBase64) {
        try {
            // Clean the string in case WS added invisible characters
            const cleanBase64 = String(encryptedBase64).trim();
            const encryptedData = Buffer.from(cleanBase64, 'base64');
            
            if (encryptedData.length <= 16) {
                console.error('[Security] Decrypt failed: Payload too short to contain IV');
                return null;
            }

            const iv = encryptedData.slice(0, 16);
            const ciphertext = encryptedData.slice(16);
            
            // FIX: Use SecurityUtils.AES_KEY instead of this.AES_KEY
            const decipher = crypto.createDecipheriv('aes-256-cbc', SecurityUtils.AES_KEY, iv);
            decipher.setAutoPadding(true); // Matches BCRYPT_BLOCK_PADDING
            
            let decrypted = decipher.update(ciphertext);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted;
        } catch (err) {
            console.error(`[Security] Decryption Error: ${err.message}`);
            return null;
        }
    }

    /**
     * Anti-Replay Attack Logic
     */
    static async isMessageValid(redis, messageId, clientTimestamp) {
        if (!messageId || !clientTimestamp) {
            return { valid: false, reason: 'Missing message_id or timestamp' };
        }

        const now = Math.floor(Date.now() / 1000);
        
        // 1. Timestamp Verification
        const diff = Math.abs(now - clientTimestamp);
        // FIX: Use SecurityUtils instead of this
        if (diff > SecurityUtils.REPLAY_WINDOW_SECONDS) {
            return { valid: false, reason: `Clock Drift or Replay: Server ${now}, Client ${clientTimestamp}` };
        }

        // 2. Message ID Uniqueness (Idempotency check)
        const cacheKey = `msg_id:${messageId}`;
        // FIX: Use SecurityUtils instead of this
        const isNew = await redis.set(cacheKey, '1', 'EX', SecurityUtils.REPLAY_WINDOW_SECONDS * 2, 'NX');
        
        if (!isNew) {
            return { valid: false, reason: 'Duplicate message_id detected (Replay Attack)' };
        }

        return { valid: true };
    }
}

module.exports = SecurityUtils;