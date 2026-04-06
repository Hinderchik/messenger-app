import crypto from 'crypto';
import argon2 from 'argon2';

let HMAC_SECRET = process.env.HMAC_SECRET;
if (!HMAC_SECRET) {
    HMAC_SECRET = crypto.randomBytes(32).toString('hex');
    console.log('⚠️  WARNING: Using generated HMAC secret!');
}
HMAC_SECRET = Buffer.from(HMAC_SECRET, 'hex');

function customTransform(data, salt, secret, iteration) {
    let result = Buffer.from(data);
    const saltCycle = Buffer.alloc(result.length);
    for (let i = 0; i < result.length; i++) {
        saltCycle[i] = salt[i % salt.length];
    }
    
    const secretByte = secret[iteration % secret.length] || 0x42;
    let numRounds = ((iteration % 7) + 3) ^ (secretByte & 0x07);
    if (numRounds < 1) numRounds = 3;
    
    for (let round = 0; round < numRounds; round++) {
        const sbox = Array.from({ length: 256 }, (_, i) => 
            ((i * 131071) % 256) ** 0.5 * 37 & 0xFF
        ).map(val => (val ^ secretByte ^ round) & 0xFF);
        
        for (let i = 0; i < result.length; i++) {
            let tmp = result[i] ^ saltCycle[i] ^ (round * 17) ^ secretByte;
            tmp = sbox[tmp & 0xFF];
            tmp = (tmp * 131) & 0xFF;
            tmp = tmp ^ (tmp >> 3) ^ (tmp << 2);
            tmp = (tmp + result[(i + 1) % result.length] + secretByte) & 0xFF;
            result[i] = tmp ^ (round * 19) ^ (secretByte >> 1);
        }
        
        for (let i = result.length - 1; i >= 0; i--) {
            result[i] = result[i] ^ result[(i + round) % result.length] ^ secretByte;
        }
    }
    
    return result;
}

const CHAINS = {
    1: [['blake2b', 32], ['sha256', 32], ['custom', 0]],
    2: [['sha256', 32], ['sha512', 64], ['custom', 0], ['blake2b', 64]],
    3: [['custom', 0], ['sha256', 32], ['sha512', 64]],
    4: [['sha512', 64], ['custom', 0], ['blake2b', 64]],
    5: [['blake2b', 64], ['sha256', 32], ['sha512', 64], ['custom', 0]],
    6: [['sha256', 32], ['custom', 0], ['sha256', 32], ['blake2b', 32]],
    7: [['sha512', 64], ['custom', 0], ['blake2b', 64]],
    8: [['custom', 0], ['blake2b', 32], ['sha256', 32], ['custom', 0], ['sha512', 64]],
    9: [['sha256', 32], ['sha512', 64], ['custom', 0], ['blake2b', 64]],
    10: [['blake2b', 64], ['custom', 0], ['sha256', 32], ['sha512', 64]],
};

function getChainById(digit) {
    if (digit < 1 || digit > 10) {
        digit = ((digit * 7 + 13) % 10) + 1;
    }
    return CHAINS[digit] || CHAINS[1];
}

async function applyHashChain(password, salt, chain) {
    let current = Buffer.from(password, 'utf8');
    
    for (let idx = 0; idx < chain.length; idx++) {
        const startTime = Date.now();
        const funcName = chain[idx][0];
        
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
            current = customTransform(current, salt, HMAC_SECRET, idx);
        }
        
        const elapsed = Date.now() - startTime;
        if (elapsed < 15) {
            await new Promise(resolve => setTimeout(resolve, 15 - elapsed));
        }
    }
    
    const argonHash = await argon2.hash(current.toString('hex') + salt.toString('hex'), {
        type: argon2.argon2id,
        timeCost: 3,
        memoryCost: 65536,
        parallelism: 2
    });
    
    const finalHash = crypto.createHash('sha512');
    current = finalHash.update(Buffer.concat([current, Buffer.from(argonHash), salt])).digest();
    
    if (current.length < 64) {
        current = Buffer.concat([current, crypto.randomBytes(64 - current.length)]);
    } else if (current.length > 64) {
        current = current.slice(0, 64);
    }
    
    return current;
}

export async function register(password) {
    if (password.length < 8 || password.length > 16) {
        throw new Error('Password must be 8-16 characters long');
    }
    
    const allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+-=";
    for (let i = 0; i < password.length; i++) {
        if (!allowed.includes(password[i])) {
            throw new Error('Password contains invalid characters');
        }
    }
    
    const salt = crypto.randomBytes(32);
    const saltBase64 = salt.toString('base64');
    
    const chainId = Math.floor(Math.random() * 10) + 1;
    const chain = getChainById(chainId);
    
    const hashResult = await applyHashChain(password, salt, chain);
    
    const finalHmac = crypto.createHmac('sha512', HMAC_SECRET);
    const finalHash = finalHmac.update(hashResult).digest();
    const finalBase64 = finalHash.toString('base64');
    
    await new Promise(resolve => setTimeout(resolve, 20));
    
    return { hash: finalBase64, chainId, salt: saltBase64 };
}

export async function verify(password, storedHash, chainId, saltBase64) {
    if (!storedHash || !saltBase64) return false;
    
    try {
        const salt = Buffer.from(saltBase64, 'base64');
        const chain = getChainById(chainId);
        
        const hashResult = await applyHashChain(password, salt, chain);
        
        const computedHmac = crypto.createHmac('sha512', HMAC_SECRET);
        const computedHash = computedHmac.update(hashResult).digest();
        const computedBase64 = computedHash.toString('base64');
        
        const storedBytes = Buffer.from(storedHash);
        const computedBytes = Buffer.from(computedBase64);
        
        if (storedBytes.length !== computedBytes.length) return false;
        
        let diff = 0;
        for (let i = 0; i < storedBytes.length; i++) {
            diff |= storedBytes[i] ^ computedBytes[i];
        }
        
        if (diff !== 0) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 70 + 50));
        }
        
        return diff === 0;
    } catch (error) {
        return false;
    }
}
