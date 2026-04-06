import crypto from 'crypto';

export async function hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('base64');
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
    return { hash, chainId: 1, salt };
}

export async function verifyPassword(password, storedHash, chainId, saltB64) {
    const hash = crypto.createHash('sha256').update(password + saltB64).digest('hex');
    return hash === storedHash;
}
