import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PasswordService } from './password.service';

const vectors: { password: string; method: string; hash: string }[] = JSON.parse(
  readFileSync(join(__dirname, '../../../test/fixtures/werkzeug-vectors.json'), 'utf8'),
).vectors;

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('hash', () => {
    it('gera hash bcrypt para senha nova', async () => {
      const hash = await service.hash('SenhaNova@1');
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
    });

    it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
      const [first, second] = await Promise.all([
        service.hash('MesmaSenha1'),
        service.hash('MesmaSenha1'),
      ]);
      expect(first).not.toBe(second);
    });

    it('valida o hash que acabou de gerar, sem pedir rehash', async () => {
      const hash = await service.hash('SenhaNova@1');
      await expect(service.verify('SenhaNova@1', hash)).resolves.toEqual({
        valid: true,
        needsRehash: false,
      });
    });
  });

  describe('verify com hash legado do Werkzeug', () => {
    const scryptVector = vectors.find((v) => v.method === 'scrypt')!;

    it('aceita a senha e sinaliza rehash', async () => {
      await expect(
        service.verify(scryptVector.password, scryptVector.hash),
      ).resolves.toEqual({ valid: true, needsRehash: true });
    });

    it('rejeita senha errada sem pedir rehash', async () => {
      await expect(service.verify('senha-errada', scryptVector.hash)).resolves.toEqual({
        valid: false,
        needsRehash: false,
      });
    });

    it('aceita hashes pbkdf2 do legado', async () => {
      const pbkdf2Vector = vectors.find((v) => v.method === 'pbkdf2:sha256:1000')!;
      await expect(
        service.verify(pbkdf2Vector.password, pbkdf2Vector.hash),
      ).resolves.toEqual({ valid: true, needsRehash: true });
    });
  });

  describe('robustez', () => {
    it.each([
      ['senha vazia', '', 'algum-hash'],
      ['hash vazio', 'senha', ''],
      ['hash lixo', 'senha', 'nao-e-um-hash'],
      ['hash truncado', 'senha', '$2a$12$curto'],
    ])('não lança para %s', async (_label, password, hash) => {
      await expect(service.verify(password, hash)).resolves.toEqual({
        valid: false,
        needsRehash: false,
      });
    });
  });

  describe('spendDummyWork', () => {
    /**
     * Este teste existe porque a primeira versão usava um hash bcrypt
     * malformado: `bcrypt.compare` retornava false imediatamente e o trabalho
     * artificial não acontecia, deixando o canal lateral de latência aberto.
     */
    it('consome trabalho comparável a uma verificação real', async () => {
      const realHash = await service.hash('SenhaReal1');

      const startReal = process.hrtime.bigint();
      await service.verify('SenhaReal1', realHash);
      const realMs = Number(process.hrtime.bigint() - startReal) / 1e6;

      const startDummy = process.hrtime.bigint();
      await service.spendDummyWork();
      const dummyMs = Number(process.hrtime.bigint() - startDummy) / 1e6;

      // Mesma ordem de magnitude: o objetivo é não vazar existência por latência.
      expect(dummyMs).toBeGreaterThan(realMs * 0.5);
      // Piso absoluto: um retorno instantâneo (hash inválido) não passa daqui.
      expect(dummyMs).toBeGreaterThan(20);
    });
  });
});
