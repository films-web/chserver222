const crypto = require('crypto');

class SecurityUtils {
    // Matches C++ Constants::AesTransportKey()
    static AES_KEY = (() => {
        const raw = process.env.AES_ENCRYPTION_KEY || 'Ch34tH4r4m_S3cr3t_K3y_256B1t_!!!';
        const buf = Buffer.from(raw, 'utf8');
        if (buf.length === 32) return buf;
        
        const finalBuf = Buffer.alloc(32, 0);
        buf.copy(finalBuf, 0, 0, Math.min(buf.length, 32));
        return finalBuf;
    })();

    static REPLAY_WINDOW_SECONDS = 30;

    /**
     * Verifies the HMAC-SHA256 signature from the loader
     */
    static isValidSignature(hwid, signature, loaderSecret) {
        if (!hwid || !signature || !loaderSecret) return false;

        try {
            const expectedSignature = crypto
                .createHmac('sha256', loaderSecret)
                .update(hwid)
                .digest('hex');

            // Secure comparison to prevent timing attacks
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (err) {
            return false;
        }
    }

    /**
     * Encrypts outgoing packets: Base64(IV + Ciphertext)
     */
    static encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', SecurityUtils.AES_KEY, iv);
            let encrypted = cipher.update(data);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            // Format: IV (16 bytes) + Ciphertext, then Base64
            const result = Buffer.concat([iv, encrypted]);
            return result.toString('base64');
        } catch (err) {
            return null;
        }
    }

    /**
     * Decrypts incoming packets from the loader
     */
    static decrypt(encryptedBase64) {
        try {
            const cleanBase64 = String(encryptedBase64).trim();
            const encryptedData = Buffer.from(cleanBase64, 'base64');
            
            if (encryptedData.length <= 16) return null;

            const iv = encryptedData.slice(0, 16);
            const ciphertext = encryptedData.slice(16);
            
            const decipher = crypto.createDecipheriv('aes-256-cbc', SecurityUtils.AES_KEY, iv);
            decipher.setAutoPadding(true); 
            
            let decrypted = decipher.update(ciphertext);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted;
        } catch (err) {
            return null;
        }
    }

    static async isMessageValid(redis, messageId, clientTimestamp) {
        if (!messageId || !clientTimestamp) return { valid: false, reason: 'Missing meta' };

        const now = Math.floor(Date.now() / 1000);
        const diff = Math.abs(now - (Number(clientTimestamp)));
        
        if (diff > SecurityUtils.REPLAY_WINDOW_SECONDS) {
            return { valid: false, reason: 'Timestamp expired' };
        }

        const cacheKey = `msg_id:${messageId}`;
        const isNew = await redis.set(cacheKey, '1', 'EX', 60, 'NX');
        
        return isNew ? { valid: true } : { valid: false, reason: 'Replay' };
    }
}

module.exports = SecurityUtils;