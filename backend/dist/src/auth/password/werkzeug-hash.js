"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWerkzeugHash = exports.checkWerkzeugPassword = exports.parseWerkzeugHash = void 0;
const node_crypto_1 = require("node:crypto");
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 192 * 1024 * 1024;
const MAX_SCRYPT_N = 1 << 20;
const MAX_PBKDF2_ITERATIONS = 10_000_000;
const DIGEST_LENGTHS = {
    sha1: 20,
    sha224: 28,
    sha256: 32,
    sha384: 48,
    sha512: 64,
};
function parseWerkzeugHash(stored) {
    if (typeof stored !== 'string')
        return null;
    const fields = stored.split('$');
    if (fields.length !== 3)
        return null;
    const [methodPart, salt, expectedHex] = fields;
    if (!salt || !/^[0-9a-fA-F]+$/.test(expectedHex))
        return null;
    const parameters = methodPart.split(':');
    const algorithm = parameters[0];
    if (algorithm === 'scrypt') {
        if (parameters.length !== 4)
            return null;
        const [N, r, p] = parameters.slice(1).map((value) => Number(value));
        if (![N, r, p].every((value) => Number.isInteger(value) && value > 0))
            return null;
        if (N > MAX_SCRYPT_N || r > 64 || p > 64)
            return null;
        if ((N & (N - 1)) !== 0)
            return null;
        return {
            algorithm: 'scrypt',
            scrypt: { N, r, p },
            salt,
            expectedHex: expectedHex.toLowerCase(),
        };
    }
    if (algorithm === 'pbkdf2') {
        if (parameters.length < 2 || parameters.length > 3)
            return null;
        const digest = parameters[1].toLowerCase();
        if (!(digest in DIGEST_LENGTHS))
            return null;
        const iterations = parameters.length === 3 ? Number(parameters[2]) : 1_000_000;
        if (!Number.isInteger(iterations) || iterations <= 0)
            return null;
        if (iterations > MAX_PBKDF2_ITERATIONS)
            return null;
        return {
            algorithm: 'pbkdf2',
            pbkdf2: { digest, iterations },
            salt,
            expectedHex: expectedHex.toLowerCase(),
        };
    }
    return null;
}
exports.parseWerkzeugHash = parseWerkzeugHash;
function computeDigest(password, parsed) {
    const saltBytes = Buffer.from(parsed.salt, 'utf8');
    const passwordBytes = Buffer.from(password, 'utf8');
    if (parsed.algorithm === 'scrypt') {
        const { N, r, p } = parsed.scrypt;
        return (0, node_crypto_1.scryptSync)(passwordBytes, saltBytes, SCRYPT_KEY_LENGTH, {
            N,
            r,
            p,
            maxmem: SCRYPT_MAX_MEMORY,
        });
    }
    const { digest, iterations } = parsed.pbkdf2;
    return (0, node_crypto_1.pbkdf2Sync)(passwordBytes, saltBytes, iterations, DIGEST_LENGTHS[digest], digest);
}
function checkWerkzeugPassword(password, stored) {
    const parsed = parseWerkzeugHash(stored);
    if (!parsed)
        return false;
    let expected;
    try {
        expected = Buffer.from(parsed.expectedHex, 'hex');
    }
    catch {
        return false;
    }
    let actual;
    try {
        actual = computeDigest(password, parsed);
    }
    catch {
        return false;
    }
    if (actual.length !== expected.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(actual, expected);
}
exports.checkWerkzeugPassword = checkWerkzeugPassword;
function isWerkzeugHash(stored) {
    return parseWerkzeugHash(stored) !== null;
}
exports.isWerkzeugHash = isWerkzeugHash;
//# sourceMappingURL=werkzeug-hash.js.map