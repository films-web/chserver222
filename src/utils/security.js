const crypto = require('crypto');

class SecurityUtils {
    // Matches your C++ AesTransportKey
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
     * REAL SIGNATURE CHECK
     * Uses HMAC-SHA256 to verify the HWID wasn't tampered with.
     */
    static isValidSignature(hwid, signature, loaderSecret) {
        if (!hwid || !signature || !loaderSecret) return false;[cite: 2]

        try {
            // Re-calculate the expected signature using the loader's secret key[cite: 2]
            const expectedSignature = crypto
                .createHmac('sha256', loaderSecret)
                .update(hwid)
                .digest('hex');

            // Constant-time comparison to prevent timing attacks[cite: 2]
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (err) {
            return false;
        }
    }

    static encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', SecurityUtils.AES_KEY, iv);
            let encrypted = cipher.update(data);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return Buffer.concat([iv, encrypted]).toString('base64');
        } catch (err) {
            return null;
        }
    }

    static decrypt(encryptedBase64) {
        try {
            const encryptedData = Buffer.from(String(encryptedBase64).trim(), 'base64');
            if (encryptedData.length <= 16) return null;
            const iv = encryptedData.slice(0, 16);
            const ciphertext = encryptedData.slice(16);
            const decipher = crypto.createDecipheriv('aes-256-cbc', SecurityUtils.AES_KEY, iv);
            let decrypted = decipher.update(ciphertext);
            return Buffer.concat([decrypted, decipher.final()]);
        } catch (err) {
            return null;
        }
    }

    static async isMessageValid(redis, messageId, clientTimestamp) {
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - clientTimestamp) > SecurityUtils.REPLAY_WINDOW_SECONDS) return { valid: false };[cite: 1]
        const isNew = await redis.set(`msg_id:${messageId}`, '1', 'EX', 60, 'NX');
        return isNew ? { valid: true } : { valid: false };
    }
}

module.exports = SecurityUtils;