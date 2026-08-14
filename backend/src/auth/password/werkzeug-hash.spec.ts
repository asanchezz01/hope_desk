import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkWerkzeugPassword,
  isWerkzeugHash,
  parseWerkzeugHash,
} from './werkzeug-hash';

interface VectorFile {
  generatedBy: string;
  vectors: { password: string; method: string; hash: string }[];
}

/**
 * Vetores REAIS gerados pelo Werkzeug instalado no legado.
 * Regerar com: .venv/Scripts/python.exe scripts/gen_werkzeug_vectors.py
 */
const vectorFile: VectorFile = JSON.parse(
  readFileSync(join(__dirname, '../../../test/fixtures/werkzeug-vectors.json'), 'utf8'),
);

describe('compatibilidade com hashes Werkzeug', () => {
  it('carregou os vetores gerados pelo legado', () => {
    expect(vectorFile.generatedBy).toMatch(/^werkzeug 3\./);
    expect(vectorFile.vectors.length).toBeGreaterThanOrEqual(30);
  });

  describe('aceita a senha correta para todo vetor do legado', () => {
    it.each(
      vectorFile.vectors.map(
        (vector) =>
          [vector.method, vector.password, vector.hash] as [string, string, string],
      ),
    )('%s / senha %j', (_method, password, hash) => {
      expect(checkWerkzeugPassword(password, hash)).toBe(true);
    });
  });

  describe('rejeita senhas erradas', () => {
    it.each(
      vectorFile.vectors.map(
        (vector) =>
          [vector.method, vector.password, vector.hash] as [string, string, string],
      ),
    )('%s / senha %j alterada', (_method, password, hash) => {
      expect(checkWerkzeugPassword(`${password}x`, hash)).toBe(false);
      expect(checkWerkzeugPassword(password.slice(0, -1), hash)).toBe(false);
      expect(checkWerkzeugPassword('', hash)).toBe(false);
    });
  });

  describe('parse do formato', () => {
    const scryptVector = vectorFile.vectors.find((v) => v.method === 'scrypt')!;
    const pbkdf2Vector = vectorFile.vectors.find(
      (v) => v.method === 'pbkdf2:sha256:1000',
    )!;

    it('lê os parâmetros do scrypt (separador : e N literal)', () => {
      const parsed = parseWerkzeugHash(scryptVector.hash);
      expect(parsed).not.toBeNull();
      expect(parsed!.algorithm).toBe('scrypt');
      // 32768 é o N literal, não log2(N).
      expect(parsed!.scrypt).toEqual({ N: 32768, r: 8, p: 1 });
    });

    it('lê o salt como texto literal, não como hex', () => {
      const parsed = parseWerkzeugHash(scryptVector.hash)!;
      const saltFromHash = scryptVector.hash.split('$')[1];
      expect(parsed.salt).toBe(saltFromHash);
      // O salt do Werkzeug é alfanumérico e normalmente não é hex válido.
      expect(parsed.salt).toHaveLength(16);
    });

    it('lê digest e iterações do pbkdf2', () => {
      const parsed = parseWerkzeugHash(pbkdf2Vector.hash)!;
      expect(parsed.algorithm).toBe('pbkdf2');
      expect(parsed.pbkdf2).toEqual({ digest: 'sha256', iterations: 1000 });
    });

    it('assume o default de 1.000.000 iterações quando omitidas', () => {
      const parsed = parseWerkzeugHash('pbkdf2:sha256$abcdefghijklmnop$00112233')!;
      expect(parsed.pbkdf2?.iterations).toBe(1_000_000);
    });

    it.each([
      ['vazio', ''],
      ['sem separadores', 'apenastexto'],
      ['campos insuficientes', 'scrypt:32768:8:1$salt'],
      ['campos demais', 'scrypt:32768:8:1$salt$abcd$extra'],
      ['algoritmo desconhecido', 'argon2:1:2$salt$abcd'],
      ['digest desconhecido', 'pbkdf2:md4:1000$salt$abcd'],
      ['hash não hex', 'scrypt:32768:8:1$salt$zzzz'],
      ['N não potência de 2', 'scrypt:32767:8:1$salt$abcd'],
      ['parâmetro não numérico', 'scrypt:abc:8:1$salt$abcd'],
      ['iterações zero', 'pbkdf2:sha256:0$salt$abcd'],
      ['salt vazio', 'scrypt:32768:8:1$$abcd'],
      ['formato antigo errado (separador $)', 'scrypt$32768$8$1$salt$abcd'],
    ])('rejeita hash malformado: %s', (_label, malformed) => {
      expect(parseWerkzeugHash(malformed)).toBeNull();
      expect(isWerkzeugHash(malformed)).toBe(false);
      // Nunca deve lançar — apenas devolver false.
      expect(checkWerkzeugPassword('qualquer', malformed)).toBe(false);
    });

    it('recusa parâmetros absurdos em vez de tentar computar (anti-DoS)', () => {
      expect(parseWerkzeugHash('scrypt:4194304:8:1$salt$abcd')).toBeNull();
      expect(parseWerkzeugHash('pbkdf2:sha256:999999999$salt$abcd')).toBeNull();
    });

    it('não lança para entradas de tipo inesperado', () => {
      expect(isWerkzeugHash(null as unknown as string)).toBe(false);
      expect(isWerkzeugHash(undefined as unknown as string)).toBe(false);
      expect(checkWerkzeugPassword('senha', undefined as unknown as string)).toBe(
        false,
      );
    });
  });

  describe('reconhecimento de hash', () => {
    it('reconhece todos os hashes do legado', () => {
      for (const vector of vectorFile.vectors) {
        expect(isWerkzeugHash(vector.hash)).toBe(true);
      }
    });

    it('não confunde um hash bcrypt com hash Werkzeug', () => {
      const bcryptHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
      expect(isWerkzeugHash(bcryptHash)).toBe(false);
    });
  });

  describe('senhas com caracteres especiais', () => {
    it('trata `$` na senha sem confundir com o separador', () => {
      const vector = vectorFile.vectors.find((v) => v.password.includes('$'))!;
      expect(vector).toBeDefined();
      expect(checkWerkzeugPassword(vector.password, vector.hash)).toBe(true);
    });

    it('trata acentuação multibyte via UTF-8', () => {
      const vector = vectorFile.vectors.find((v) => v.password.includes('acentos'))!;
      expect(vector.password).toBe('çãõÜ-acentos');
      expect(checkWerkzeugPassword(vector.password, vector.hash)).toBe(true);
    });

    it('trata senha longa sem truncar', () => {
      const vector = vectorFile.vectors.find((v) => v.password.length === 100)!;
      expect(checkWerkzeugPassword(vector.password, vector.hash)).toBe(true);
      // Truncar em 72 (limite do bcrypt) daria falso positivo.
      expect(checkWerkzeugPassword(vector.password.slice(0, 72), vector.hash)).toBe(
        false,
      );
    });
  });
});
