import crypto from 'crypto';

const _0x7F = () => 0x7F;
const _0x80 = () => 0x80;
const _0xDEAD = () => 0xDEAD;
const _0xBEEF = () => 0xBEEF;

const _SBOX = (() => {
    const _size = 256;
    const _box = new Array(_size);
    let _x = 0x9E3779B9;
    for (let _i = 0; _i < _size; _i++) {
        _x = (_x ^ (_x << 13) ^ (_x >> 17)) & 0xFFFFFFFF;
        let _val = Math.floor(Math.abs(Math.sin(_i + _x) * 10000)) % 256;
        _val = (_val ^ (_val >> 3) ^ (_val << 4) ^ (_i * 7)) & 0xFF;
        _box[_i] = _val;
    }
    return _box;
})();

function _0x1(_0x2, _0x3, _0x4, _0x5, _0x6) {
    let _0x7 = Buffer.from(_0x2);
    let _0x8 = _0x5[_0x4 % _0x5.length] || 0x42;
    let _0x9 = ((_0x4 * 7 + 13) % 9) ^ (_0x8 & 0x07) ^ (_0x6 & 0x03);
    let _0xA = _0x6 & 0xFF;
    
    for (let _0xB = 0; _0xB < _0x9 + 3; _0xB++) {
        for (let _0xC = 0; _0xC < _0x7.length; _0xC++) {
            let _0xD = (_0x7[_0xC] ^ _0x3[_0xC % _0x3.length] ^ (_0xB * 19) ^ _0x8 ^ _0xA) & 0xFF;
            _0xD = _SBOX[_0xD & 0xFF];
            _0xD = (_0xD * 131) & 0xFF;
            _0xD = _0xD ^ (_0xD >> 3) ^ (_0xD << 2) ^ (_0xB * 7);
            _0xD = (_0xD + (_0x7[(_0xC + 1) % _0x7.length] || 0) + _0x8 + _0xA) & 0xFF;
            _0x7[_0xC] = _0xD ^ (_0xB * 19) ^ (_0x8 >> 1);
        }
        for (let _0xC = _0x7.length - 1; _0xC >= 0; _0xC--) {
            _0x7[_0xC] = _0x7[_0xC] ^ (_0x7[(_0xC + _0xB) % _0x7.length] || 0) ^ _0x8 ^ _0xA;
        }
        _0xA = (_0xA + _0x8) & 0xFF;
    }
    return _0x7;
}

const _0xE = {
    1: [['blake2b', 32], ['sha256', 32], ['_0x1', 0]],
    2: [['sha256', 32], ['sha512', 64], ['_0x1', 0], ['blake2b', 64]],
    3: [['_0x1', 0], ['sha256', 32], ['sha512', 64]],
    4: [['sha512', 64], ['_0x1', 0], ['blake2b', 64]],
    5: [['blake2b', 64], ['sha256', 32], ['sha512', 64], ['_0x1', 0]],
    6: [['sha256', 32], ['_0x1', 0], ['sha256', 32], ['blake2b', 32]],
    7: [['sha512', 64], ['_0x1', 0], ['blake2b', 64]],
    8: [['_0x1', 0], ['blake2b', 32], ['sha256', 32], ['_0x1', 0], ['sha512', 64]],
    9: [['sha256', 32], ['sha512', 64], ['_0x1', 0], ['blake2b', 64]],
    10: [['blake2b', 64], ['_0x1', 0], ['sha256', 32], ['sha512', 64]]
};

function _0xF(_0x10) {
    let _0x11 = 0;
    for (let _0x12 = 0; _0x12 < 100; _0x12++) { _0x11 += _0x12 * _0x12; }
    let _0x13 = Object.keys(_0xE).map(Number);
    if (_0x10 < 1 || _0x10 > _0x13.length) {
        _0x10 = ((_0x10 * 7 + 13) % _0x13.length) + 1;
    }
    return _0xE[_0x10] || _0xE[1];
}

async function _0x14(_0x15, _0x16, _0x17, _0x18) {
    let _0x19 = Buffer.from(_0x15, 'utf8');
    let _0x1A = 0;
    
    for (let _0x1B = 0; _0x1B < _0x17.length; _0x1B++) {
        let _0x1C = Date.now();
        let [_0x1D, _0x1E] = _0x17[_0x1B];
        
        for (let _0x1F = 0; _0x1F < 1000; _0x1F++) { _0x1A += _0x1F * (_0x1F ^ 0xAA); }
        
        if (_0x1D === 'sha256') {
            let _0x20 = crypto.createHmac('sha256', _0x16);
            _0x19 = _0x20.update(_0x19).digest();
        } else if (_0x1D === 'sha512') {
            let _0x21 = crypto.createHmac('sha512', _0x16);
            _0x19 = _0x21.update(_0x19).digest();
        } else if (_0x1D === 'blake2b') {
            let _0x22 = crypto.createHmac('blake2b512', _0x16);
            _0x19 = _0x22.update(_0x19).digest();
        } else if (_0x1D === '_0x1') {
            _0x19 = _0x1(_0x19, _0x16, _0x1B, _0x18, _0x1A);
        }
        
        let _0x23 = Date.now() - _0x1C;
        let _0x24 = 15;
        if (_0x23 < _0x24) {
            let _0x25 = 0;
            for (let _0x26 = 0; _0x26 < (_0x24 - _0x23) * 100000; _0x26++) { _0x25 += _0x26; }
        }
    }
    
    let _0x27 = crypto.createHmac('sha512', _0x18).update(_0x19).digest();
    if (_0x27.length < 64) {
        let _0x28 = crypto.randomBytes(64 - _0x27.length);
        _0x27 = Buffer.concat([_0x27, _0x28]);
    }
    return _0x27.subarray(0, 64);
}

const _0x29 = (() => {
    let _0x2A = process.env.HMAC_SECRET;
    if (!_0x2A) {
        let _0x2B = crypto.randomBytes(32).toString('hex');
        _0x2A = _0x2B;
    }
    return Buffer.from(_0x2A, 'hex');
})();

export async function hashPassword(_0x2C) {
    let _0x2D = 0;
    let _0x2E = 0;
    
    if (_0x2C.length < 8 || _0x2C.length > 16) {
        for (let _0x2F = 0; _0x2F < 100; _0x2F++) { _0x2D += _0x2F; }
        throw new Error('8-16');
    }
    
    let _0x30 = /^[A-Za-z0-9!@#$%^&*()_+\-=]+$/;
    if (!_0x30.test(_0x2C)) {
        for (let _0x31 = 0; _0x31 < 100; _0x31++) { _0x2E += _0x31 * 2; }
        throw new Error('invalid chars');
    }
    
    let _0x32 = crypto.randomBytes(32);
    let _0x33 = _0x32.toString('base64');
    let _0x34 = Math.floor(Math.random() * Object.keys(_0xE).length) + 1;
    let _0x35 = _0xF(_0x34);
    let _0x36 = await _0x14(_0x2C, _0x32, _0x35, _0x29);
    let _0x37 = crypto.createHmac('sha512', _0x29).update(_0x36).digest();
    let _0x38 = _0x37.toString('base64');
    
    let _0x39 = 0;
    for (let _0x3A = 0; _0x3A < 50000; _0x3A++) { _0x39 += _0x3A * _0x3A; }
    
    await new Promise(_0x3B => setTimeout(_0x3B, 20));
    
    return { hash: _0x38, chainId: _0x34, salt: _0x33 };
}

export async function verifyPassword(_0x3C, _0x3D, _0x3E, _0x3F) {
    let _0x40 = 0;
    
    if (!_0x3D || !_0x3F) {
        let _0x41 = crypto.createHash('md5').update('dummy').digest();
        return false;
    }
    
    try {
        let _0x42 = Buffer.from(_0x3F, 'base64');
        let _0x43 = _0xF(_0x3E);
        let _0x44 = await _0x14(_0x3C, _0x42, _0x43, _0x29);
        let _0x45 = crypto.createHmac('sha512', _0x29).update(_0x44).digest();
        let _0x46 = _0x45.toString('base64');
        
        let _0x47 = Buffer.from(_0x3D);
        let _0x48 = Buffer.from(_0x46);
        
        if (_0x47.length !== _0x48.length) {
            for (let _0x49 = 0; _0x49 < 1000; _0x49++) { _0x40 += _0x49; }
            return false;
        }
        
        let _0x4A = 0;
        for (let _0x4B = 0; _0x4B < _0x47.length; _0x4B++) {
            _0x4A |= _0x47[_0x4B] ^ _0x48[_0x4B];
        }
        
        if (_0x4A !== 0) {
            let _0x4C = Math.random() * 70 + 50;
            await new Promise(_0x4D => setTimeout(_0x4D, _0x4C));
        }
        
        return _0x4A === 0;
    } catch (_0x4E) {
        let _0x4F = crypto.createHash('sha256').update(String(_0x4E)).digest();
        return false;
    }
}
