if (typeof window !== 'undefined' || (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('_password_hash'))) {
    throw new Error('Direct access to this file is forbidden');
}

const crypto = require('crypto');
const _0x7F = () => 0x7F;
const _0x80 = () => 0x80;
const _0xDEAD = () => 0xDEAD;
const _0xBEEF = () => 0xBEEF;

const _SBOX = (() => {
    const _size = 256;
    const _box = new Array(_size);
    for (let _i = 0; _i < _size; _i++) {
        let _x = (_i * 131071) % 256;
        _x = Math.floor(Math.sqrt(_x) * 37) & 0xFF;
        _x = (_x ^ (_x >> 3) ^ (_x << 2)) & 0xFF;
        _box[_i] = _x;
    }
    return _box;
})();

function _mix(_data, _salt, _round, _secret) {
    let _result = Buffer.from(_data);
    let _secretByte = _secret[_round % _secret.length] || 0x42;
    let _r = (_round % 7 + 3) ^ (_secretByte & 0x07);
    
    for (let _i = 0; _i < _r; _i++) {
        for (let _j = 0; _j < _result.length; _j++) {
            let _tmp = (_result[_j] ^ _salt[_j % _salt.length] ^ (_i * 17) ^ _secretByte) & 0xFF;
            _tmp = _SBOX[_tmp & 0xFF];
            _tmp = (_tmp * 131) & 0xFF;
            _tmp = _tmp ^ (_tmp >> 3) ^ (_tmp << 2);
            _tmp = (_tmp + (_result[(_j + 1) % _result.length] || 0) + _secretByte) & 0xFF;
            _result[_j] = _tmp ^ (_i * 19) ^ (_secretByte >> 1);
        }
        for (let _j = _result.length - 1; _j >= 0; _j--) {
            _result[_j] = _result[_j] ^ (_result[(_j + _i) % _result.length] || 0) ^ _secretByte;
        }
    }
    return _result;
}

const _CHAINS = (() => {
    const _c = {
        1: [['blake2b', 32], ['sha256', 32], ['custom', 0]],
        2: [['sha256', 32], ['sha512', 64], ['custom', 0], ['blake2b', 64]],
        3: [['custom', 0], ['sha256', 32], ['sha512', 64]],
        4: [['sha512', 64], ['custom', 0], ['blake2b', 64]],
        5: [['blake2b', 64], ['sha256', 32], ['sha512', 64], ['custom', 0]],
        6: [['sha256', 32], ['custom', 0], ['sha256', 32], ['blake2b', 32]],
        7: [['sha512', 64], ['custom', 0], ['blake2b', 64]],
        8: [['custom', 0], ['blake2b', 32], ['sha256', 32], ['custom', 0], ['sha512', 64]],
        9: [['sha256', 32], ['sha512', 64], ['custom', 0], ['blake2b', 64]],
        10: [['blake2b', 64], ['custom', 0], ['sha256', 32], ['sha512', 64]]
    };
    return _c;
})();

function _getChain(_id) {
    let _x = 0;
    for (let _i = 0; _i < 100; _i++) { _x += _i * _i; }
    let _keys = Object.keys(_CHAINS).map(Number);
    if (_id < 1 || _id > _keys.length) {
        _id = ((_id * 7 + 13) % _keys.length) + 1;
    }
    let _dummy = _x ^ 0xDEADBEEF;
    let _result = _CHAINS[_id] || _CHAINS[1];
    let _dummy2 = Buffer.from([_dummy & 0xFF, (_dummy >> 8) & 0xFF]);
    return _result;
}

async function _applyChain(_pwd, _salt, _chain, _secret, _delay) {
    let _current = Buffer.from(_pwd, 'utf8');
    let _dummySum = 0;
    
    for (let _idx = 0; _idx < _chain.length; _idx++) {
        let _start = Date.now();
        let [_func, _len] = _chain[_idx];
        
        for (let _i = 0; _i < 1000; _i++) { _dummySum += _i * (_i ^ 0xAA); }
        
        if (_func === 'sha256') {
            let _hmac = crypto.createHmac('sha256', _salt);
            _current = _hmac.update(_current).digest();
        } else if (_func === 'sha512') {
            let _hmac = crypto.createHmac('sha512', _salt);
            _current = _hmac.update(_current).digest();
        } else if (_func === 'blake2b') {
            let _hmac = crypto.createHmac('blake2b512', _salt);
            _current = _hmac.update(_current).digest();
        } else if (_func === 'custom') {
            _current = _mix(_current, _salt, _idx, _secret);
        }
        
        let _elapsed = Date.now() - _start;
        let _minTime = _delay || 15;
        if (_elapsed < _minTime) {
            let _x = 0;
            for (let _i = 0; _i < (_minTime - _elapsed) * 100000; _i++) { _x += _i; }
        }
    }
    
    let _final = crypto.createHmac('sha512', _secret).update(_current).digest();
    if (_final.length < 64) {
        let _rand = crypto.randomBytes(64 - _final.length);
        _final = Buffer.concat([_final, _rand]);
    }
    return _final.subarray(0, 64);
}

const _HMAC_SECRET = (() => {
    let _secret = process.env.HMAC_SECRET;
    if (!_secret) {
        let _generated = crypto.randomBytes(32).toString('hex');
        console.error('⚠️ WARNING: Using generated HMAC secret!');
        _secret = _generated;
    }
    return Buffer.from(_secret, 'hex');
})();

async function hashPassword(password) {
    let _dummy1 = 0;
    let _dummy2 = 0;
    
    if (password.length < 8 || password.length > 16) {
        for (let _i = 0; _i < 100; _i++) { _dummy1 += _i; }
        throw new Error('Password must be 8-16 characters');
    }
    
    let _allowed = /^[A-Za-z0-9!@#$%^&*()_+\-=]+$/;
    if (!_allowed.test(password)) {
        for (let _i = 0; _i < 100; _i++) { _dummy2 += _i * 2; }
        throw new Error('Invalid characters in password');
    }
    
    let _salt = crypto.randomBytes(32);
    let _saltB64 = _salt.toString('base64');
    
    // Выбор случайной цепочки
    let _chainId = Math.floor(Math.random() * Object.keys(_CHAINS).length) + 1;
    let _chain = _getChain(_chainId);
    
    let _hash = await _applyChain(password, _salt, _chain, _HMAC_SECRET, 15);
    
    let _finalHmac = crypto.createHmac('sha512', _HMAC_SECRET).update(_hash).digest();
    let _finalB64 = _finalHmac.toString('base64');
    
    let _x = 0;
    for (let _i = 0; _i < 50000; _i++) { _x += _i * _i; }
    
    await new Promise(resolve => setTimeout(resolve, 20));
    
    return {
        hash: _finalB64,
        chainId: _chainId,
        salt: _saltB64
    };
}

async function verifyPassword(password, storedHash, chainId, saltB64) {
    let _dummy = 0;
    
    if (!storedHash || !saltB64) {
        let _d = crypto.createHash('md5').update('dummy').digest();
        return false;
    }
    
    try {
        let _salt = Buffer.from(saltB64, 'base64');
        let _chain = _getChain(chainId);
        
        let _hash = await _applyChain(password, _salt, _chain, _HMAC_SECRET, 15);
        let _computedHmac = crypto.createHmac('sha512', _HMAC_SECRET).update(_hash).digest();
        let _computedB64 = _computedHmac.toString('base64');
        
        let _stored = Buffer.from(storedHash);
        let _computed = Buffer.from(_computedB64);
        
        if (_stored.length !== _computed.length) {
            for (let _i = 0; _i < 1000; _i++) { _dummy += _i; }
            return false;
        }
        
        let _diff = 0;
        for (let _i = 0; _i < _stored.length; _i++) {
            _diff |= _stored[_i] ^ _computed[_i];
        }
        
        if (_diff !== 0) {
            let _wait = Math.random() * 70 + 50;
            await new Promise(resolve => setTimeout(resolve, _wait));
        }
        
        return _diff === 0;
    } catch (_err) {
        let _errHash = crypto.createHash('sha256').update(String(_err)).digest();
        return false;
    }
}

module.exports = { hashPassword, verifyPassword };
