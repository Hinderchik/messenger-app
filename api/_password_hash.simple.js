const crypto = require('crypto');

const HMAC_SECRET = Buffer.from(process.env.HMAC_SECRET || crypto.randomBytes(32).toString('hex'), 'hex');

const _SBOX = Array.from({ length: 256 }, (_, i) => Math.floor(Math.abs(Math.sqrt((i * 131071) % 256) * 37)) & 0xFF);

function _customObfuscatedTransform(data, salt, secret, iteration) {
    let result = Buffer.from(data);
    const saltCycle = Buffer.alloc(result.length);
    for (let i = 0; i < result.length; i++) {
        saltCycle[i] = salt[i % salt.length];
    }
    const secretByte = secret[iteration % secret.length] || 0x42;
    const numRounds = ((iteration % 7) + 3) ^ (secretByte & 0x07);
    
    for (let r = 0; r < numRounds; r++) {
        const dynamicSbox = _SBOX.map(x => (x ^ secretByte ^ r) & 0xFF);
        
        for (let i = 0; i < result.length; i++) {
            let tmp = (result[i] ^ saltCycle[i] ^ (r * 17) ^ secretByte) & 0xFF;
            tmp = dynamicSbox[tmp & 0xFF];
            tmp = (tmp * 131) & 0xFF;
            tmp = tmp ^ (tmp >> 3) ^ (tmp << 2);
            tmp = (tmp + (result[(i + 1) % result.length] || 0) + secretByte) & 0xFF;
            result[i] = tmp ^ (r * 19) ^ (secretByte >> 1);
        }
        
        for (let i = result.length - 1; i >= 0; i--) {
            result[i] = result[i] ^ (result[(i + r) % result.length] || 0) ^ secretByte;
        }
    }
    return result;
}

const _CHAINS = {
    1: ['blake2b', 'sha256', 'custom'],
    2: ['sha256', 'sha512', 'custom', 'blake2b'],
    3: ['custom', 'sha256', 'sha512'],
    4: ['sha512', 'custom', 'blake2b'],
    5: ['blake2b', 'sha256', 'sha512', 'custom'],
    6: ['sha256', 'custom', 'sha256', 'blake2b'],
    7: ['sha512', 'custom', 'blake2b'],
    8: ['custom', 'blake2b', 'sha256', 'custom', 'sha512'],
    9: ['sha256', 'sha512', 'custom', 'blake2b'],
    10: ['blake2b', 'custom', 'sha256', 'sha512']
};

function getChainById(digit) {
    const keys = Object.keys(_CHAINS).map(Number);
    if (digit < 1 || digit > keys.length) {
        digit = ((digit * 7 + 13) % keys.length) + 1;
    }
    return _CHAINS[digit] || _CHAINS[1];
}

function applyHashChain(password, salt, chain) {
    let current = Buffer.from(password, 'utf8');
    
    for (let idx = 0; idx < chain.length; idx++) {
        const startTime = Date.now();
        const funcName = chain[idx];
        
        if (funcName === 'sha256') {
            const hmac = crypto.createHmac('sha256', salt);
            current = hmac.update(current).digest();
        } else if (funcName === 'sha512') {
            const hmac = crypto.createHmac('sha512', salt);
            current = hmac.update(current).digest();
        } else if (funcName === 'blake2b') {
            const hmac = crypto.createHmac('blake2b512', salt);
            current = hmac.update(current).digest();
        } else if (funcName === 'custom') {
            current = _customObfuscatedTransform(current, salt, HMAC_SECRET, idx);
        }
        
        const elapsed = Date.now() - startTime;
        const minTime = 15;
        if (elapsed < minTime) {
            let x = 0;
            for (let i = 0; i < (minTime - elapsed) * 100000; i++) { x += i; }
        }
    }
    
    const finalHmac = crypto.createHmac('sha512', HMAC_SECRET).update(current).digest();
    
    if (finalHmac.length < 64) {
        return Buffer.concat([finalHmac, crypto.randomBytes(64 - finalHmac.length)]);
    }
    return finalHmac.subarray(0, 64);
}

async function hashPassword(password) {
    if (password.length < 8 || password.length > 16) {
        throw new Error('Password must be 8-16 characters');
    }
    
    const allowed = /^[A-Za-z0-9!@#$%^&*()_+\-=]+$/;
    if (!allowed.test(password)) {
        throw new Error('Invalid characters');
    }
    
    const salt = crypto.randomBytes(32);
    const saltB64 = salt.toString('base64');
    
    const chainId = Math.floor(Math.random() * Object.keys(_CHAINS).length) + 1;
    const chain = getChainById(chainId);
    
    const hashResult = applyHashChain(password, salt, chain);
    const finalB64 = hashResult.toString('base64');
    
    await new Promise(resolve => setTimeout(resolve, 20));
    
    return { hash: finalB64, chainId, salt: saltB64 };
}

async function verifyPassword(password, storedHash, chainId, saltB64) {
    if (!storedHash || !saltB64) {
        return false;
    }
    
    try {
        const salt = Buffer.from(saltB64, 'base64');
        const chain = getChainById(chainId);
        
        const hashResult = applyHashChain(password, salt, chain);
        const computedB64 = hashResult.toString('base64');
        
        const storedBytes = Buffer.from(storedHash);
        const computedBytes = Buffer.from(computedB64);
        
        if (storedBytes.length !== computedBytes.length) {
            return false;
        }
        
        let diff = 0;
        for (let i = 0; i < storedBytes.length; i++) {
            diff |= storedBytes[i] ^ computedBytes[i];
        }
        
        if (diff !== 0) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 70 + 50));
        }
        
        return diff === 0;
    } catch (e) {
        return false;
    }
}

module.exports = { hashPassword, verifyPassword };

module.exports = { hashPassword, verifyPassword };
