/**
 * Compatibilidade com os hashes de senha do Werkzeug (Flask).
 *
 * O legado usa `werkzeug.security.generate_password_hash` /
 * `check_password_hash`. Formato (Werkzeug 3.x):
 *
 *   scrypt:<N>:<r>:<p>$<salt>$<hash-hex>
 *   pbkdf2:<sha256|sha512|...>:<iterações>$<salt>$<hash-hex>
 *
 * Pontos onde é fácil errar — e que um rascunho anterior errou:
 *   - o separador dos PARÂMETROS é `:`, não `$`;
 *   - `32768` é o N literal, não log2(N);
 *   - o SALT é uma string ASCII literal e entra na KDF como `salt.encode()`,
 *     NÃO como bytes decodificados de hex;
 *   - `dklen` do scrypt é 64; do pbkdf2 é o tamanho do digest.
 *
 * Cada afirmação acima é verificada por vetores reais gerados pelo Werkzeug
 * 3.1.3 instalado no legado (ver `werkzeug-hash.spec.ts`).
 *
 * Estratégia de migração: verificamos o hash legado no login e, quando ele não
 * está no formato preferido, fazemos rehash transparente com bcrypt.
 */
import { pbkdf2Sync, scryptSync, timingSafeEqual } from 'node:crypto';

export type WerkzeugAlgorithm = 'scrypt' | 'pbkdf2';

export interface ParsedWerkzeugHash {
  algorithm: WerkzeugAlgorithm;
  /** scrypt: N, r, p. */
  scrypt?: { N: number; r: number; p: number };
  /** pbkdf2: função de hash e número de iterações. */
  pbkdf2?: { digest: string; iterations: number };
  /** Salt ASCII literal, exatamente como aparece no hash. */
  salt: string;
  /** Digest esperado, em hex minúsculo. */
  expectedHex: string;
}

/** `dklen` fixo do scrypt no Werkzeug. */
const SCRYPT_KEY_LENGTH = 64;

/**
 * `maxmem` do Node precisa ser elevado: o default de 32 MiB é insuficiente para
 * N=32768, r=8 (128 * N * r = 32 MiB, mais overhead).
 */
const SCRYPT_MAX_MEMORY = 192 * 1024 * 1024;

/** Limite de sanidade para não permitir DoS por hash com parâmetros absurdos. */
const MAX_SCRYPT_N = 1 << 20;
const MAX_PBKDF2_ITERATIONS = 10_000_000;

const DIGEST_LENGTHS: Record<string, number> = {
  sha1: 20,
  sha224: 28,
  sha256: 32,
  sha384: 48,
  sha512: 64,
};

export function parseWerkzeugHash(stored: string): ParsedWerkzeugHash | null {
  if (typeof stored !== 'string') return null;

  const fields = stored.split('$');
  if (fields.length !== 3) return null;

  const [methodPart, salt, expectedHex] = fields;
  if (!salt || !/^[0-9a-fA-F]+$/.test(expectedHex)) return null;

  const parameters = methodPart.split(':');
  const algorithm = parameters[0];

  if (algorithm === 'scrypt') {
    // scrypt:N:r:p
    if (parameters.length !== 4) return null;
    const [N, r, p] = parameters.slice(1).map((value) => Number(value));
    if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return null;
    if (N > MAX_SCRYPT_N || r > 64 || p > 64) return null;
    // N precisa ser potência de 2.
    if ((N & (N - 1)) !== 0) return null;
    return {
      algorithm: 'scrypt',
      scrypt: { N, r, p },
      salt,
      expectedHex: expectedHex.toLowerCase(),
    };
  }

  if (algorithm === 'pbkdf2') {
    // pbkdf2:<digest>[:<iterações>] — iterações omitidas usam o default do Werkzeug.
    if (parameters.length < 2 || parameters.length > 3) return null;
    const digest = parameters[1].toLowerCase();
    if (!(digest in DIGEST_LENGTHS)) return null;
    const iterations = parameters.length === 3 ? Number(parameters[2]) : 1_000_000;
    if (!Number.isInteger(iterations) || iterations <= 0) return null;
    if (iterations > MAX_PBKDF2_ITERATIONS) return null;
    return {
      algorithm: 'pbkdf2',
      pbkdf2: { digest, iterations },
      salt,
      expectedHex: expectedHex.toLowerCase(),
    };
  }

  return null;
}

/** Recomputa o digest de um hash legado para a senha informada. */
function computeDigest(password: string, parsed: ParsedWerkzeugHash): Buffer {
  // Werkzeug faz salt.encode() — o salt é a string literal, não hex decodificado.
  const saltBytes = Buffer.from(parsed.salt, 'utf8');
  const passwordBytes = Buffer.from(password, 'utf8');

  if (parsed.algorithm === 'scrypt') {
    const { N, r, p } = parsed.scrypt!;
    return scryptSync(passwordBytes, saltBytes, SCRYPT_KEY_LENGTH, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAX_MEMORY,
    });
  }

  const { digest, iterations } = parsed.pbkdf2!;
  return pbkdf2Sync(
    passwordBytes,
    saltBytes,
    iterations,
    DIGEST_LENGTHS[digest],
    digest,
  );
}

/**
 * Equivalente a `werkzeug.security.check_password_hash`.
 * Devolve false — sem lançar — para qualquer hash malformado.
 */
export function checkWerkzeugPassword(password: string, stored: string): boolean {
  const parsed = parseWerkzeugHash(stored);
  if (!parsed) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(parsed.expectedHex, 'hex');
  } catch {
    return false;
  }

  let actual: Buffer;
  try {
    actual = computeDigest(password, parsed);
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Indica se a string tem a forma de um hash Werkzeug (sem verificar a senha). */
export function isWerkzeugHash(stored: string): boolean {
  return parseWerkzeugHash(stored) !== null;
}
