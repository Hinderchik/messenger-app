const crypto = require('crypto');

// Секретный множитель (из переменной окружения)
const SECRET_MULTIPLIER = BigInt(process.env.PWD_MULTIPLIER || '117479859374928364759283746352718293746');

// Цепочки хеш-функций
const CHAINS = {
    1: ['md5', 'sha256', 'custom'],
    2: ['sha256', 'sha512', 'custom', 'blake2b'],
    3: ['custom', 'md5', 'sha256'],
    4: ['sha512', 'custom', 'blake2b'],
    5: ['blake2b', 'sha256', 'sha512', 'custom', 'md5'],
    6: ['md5', 'custom', 'sha256', 'custom'],
    7: ['sha256', 'custom', 'sha512'],
    8: ['custom', 'blake2b', 'sha256', 'custom', 'sha512'],
    9: ['sha512', 'md5', 'custom', 'blake2b'],
    10: ['blake2b', 'sha256', 'md5', 'custom', 'sha256']
};

// Кастомное нелинейное преобразование
function customWeirdTransform(data, salt) {
    let result = Buffer.from(data);
    const saltBytes = Buffer.alloc(result.length, salt);
    
    for (let i = 0; i < result.length; i++) {
        let tmp = (result[i] ^ saltBytes[i]) & 0xFF;
        tmp = ((tmp << 3) | (tmp >> 5)) & 0xFF;
        tmp = tmp ^ ((i * 33) & 0xFF);
        tmp = (tmp * 131) & 0xFF;
        tmp = tmp ^ (tmp >> 4) ^ (tmp << 2);
        result[i] = tmp & 0xFF;
    }
    
    for (let i = result.length - 1; i >= 0; i--) {
        result[i] = result[i] ^ (result[(i + 1) % result.length] ^ saltBytes[i]);
    }
    
    return result;
}

function applyHashChain(password, salt, chain) {
    let current = Buffer.concat([salt, Buffer.from(password, 'utf8')]);
    
    for (const funcName of chain) {
        const startTime = Date.now();
        
        if (funcName === 'md5') {
            current = crypto.createHash('md5').update(current).digest();
        } else if (funcName === 'sha256') {
            current = crypto.createHash('sha256').update(current).digest();
        } else if (funcName === 'sha512') {
            current = crypto.createHash('sha512').update(current).digest();
        } else if (funcName === 'blake2b') {
            current = crypto.createHash('blake2b512').update(current).digest();
        } else if (funcName === 'custom') {
            current = customWeirdTransform(current, salt);
        }
        
        // Искусственная задержка
        let x = 0;
        for (let i = 0; i < 8000; i++) {
            x += (i * i) ^ (i >> 3);
        }
        
        const elapsed = Date.now() - startTime;
        if (elapsed < 10) {
            const wait = 10 - elapsed;
            for (let i = 0; i < wait * 100000; i++) { x += i; }
        }
    }
    
    if (current.length < 64) {
        current = Buffer.concat([current, Buffer.alloc(64 - current.length, 0)]);
    } else if (current.length > 64) {
        current = current.subarray(0, 64);
    }
    
    return current;
}

function getChainById(digit) {
    if (digit < 1 || digit > Object.keys(CHAINS).length) {
        digit = ((digit * 7) % Object.keys(CHAINS).length) + 1;
    }
    return CHAINS[digit] || CHAINS[1];
}

function hashPassword(password) {
    if (password.length < 8 || password.length > 16) {
        throw new Error('Password must be 8-16 characters');
    }
    
    const allowed = /^[A-Za-z0-9!@#$%^&*()_+\-=]+$/;
    if (!allowed.test(password)) {
        throw new Error('Password contains invalid characters');
    }
    
    const salt = crypto.randomBytes(32);
    const saltB64 = salt.toString('base64');
    
    const chainId = Math.floor(Math.random() * Object.keys(CHAINS).length) + 1;
    const chain = getChainById(chainId);
    
    const hashResult = applyHashChain(password, salt, chain);
    const hashInt = BigInt('0x' + hashResult.toString('hex'));
    const finalValue = hashInt * SECRET_MULTIPLIER;
    
    return {
        hash: finalValue.toString(),
        chainId: chainId,
        salt: saltB64
    };
}

function verifyPassword(password, storedHash, chainId, saltB64) {
    try {
        const salt = Buffer.from(saltB64, 'base64');
        const chain = getChainById(chainId);
        
        const hashResult = applyHashChain(password, salt, chain);
        const hashInt = BigInt('0x' + hashResult.toString('hex'));
        const computed = hashInt * SECRET_MULTIPLIER;
        
        return computed.toString() === storedHash;
    } catch (e) {
        return false;
    }
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashPassword, verifyPassword, generateToken };
