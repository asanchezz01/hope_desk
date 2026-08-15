/**
 * A trava que não travava.
 *
 * A lista de bloqueio anterior tinha `farmacosprecodecusto.com.br`, e o host
 * real de produção é `api.farmaciasprecodecusto.com.br`. Um erro de uma letra
 * deixava `prisma:seed` gravar em produção e a suíte de integração TRUNCAR as
 * tabelas de produção — sem nenhum aviso, porque o que a lista não conhecia,
 * ela liberava.
 *
 * O primeiro teste deste arquivo é exatamente esse caso.
 */
import {
  assertDisposableDatabase,
  hostOf,
  isDisposableHost,
  isKnownProductionHost,
} from './disposable-database';

const PRODUCTION_URL =
  'postgresql://postgres:senha@api.farmaciasprecodecusto.com.br:5432/hopedesk';
const LOCAL_URL = 'postgresql://postgres:postgres@localhost:5433/hopedesk';

describe('assertDisposableDatabase', () => {
  const originalEscape = process.env.ALLOW_NON_LOCAL_DATABASE;

  afterEach(() => {
    if (originalEscape === undefined) delete process.env.ALLOW_NON_LOCAL_DATABASE;
    else process.env.ALLOW_NON_LOCAL_DATABASE = originalEscape;
  });

  it('recusa o host REAL de produção', () => {
    expect(() => assertDisposableDatabase(PRODUCTION_URL, 'semear')).toThrow(
      /PRODUÇÃO/,
    );
  });

  it('recusa produção mesmo com a variável de escape definida', () => {
    // A variável existe para destinos legítimos não-locais (uma cópia num
    // servidor de homologação, por exemplo). Produção não é um deles.
    process.env.ALLOW_NON_LOCAL_DATABASE = 'eu-confirmo';
    expect(() => assertDisposableDatabase(PRODUCTION_URL, 'semear')).toThrow(
      /PRODUÇÃO/,
    );
  });

  it('recusa qualquer host desconhecido — é o ponto da lista de permissão', () => {
    expect(() =>
      assertDisposableDatabase(
        'postgresql://u:p@servidor-qualquer:5432/base',
        'semear',
      ),
    ).toThrow(/destinos descartáveis/);
  });

  it('aceita os destinos descartáveis', () => {
    for (const url of [
      LOCAL_URL,
      'postgresql://postgres:postgres@127.0.0.1:5434/hopedesk_test',
      'postgresql://postgres:postgres@postgres:5432/hopedesk',
      'postgresql://postgres:postgres@postgres-test:5432/hopedesk_test',
    ]) {
      expect(() => assertDisposableDatabase(url, 'semear')).not.toThrow();
    }
  });

  it('libera host desconhecido só com a variável de escape', () => {
    const url = 'postgresql://u:p@homologacao.interna:5432/base';
    expect(() => assertDisposableDatabase(url, 'semear')).toThrow();

    process.env.ALLOW_NON_LOCAL_DATABASE = 'eu-confirmo';
    expect(() => assertDisposableDatabase(url, 'semear')).not.toThrow();
  });

  it('recusa URL ausente ou ilegível em vez de deixar passar', () => {
    expect(() => assertDisposableDatabase(undefined, 'semear')).toThrow(/não definida/);
    expect(() => assertDisposableDatabase('isto não é uma url', 'semear')).toThrow(
      /host ilegível|destinos descartáveis/,
    );
  });

  it('cita a operação na mensagem, para o erro dizer o que seria perdido', () => {
    expect(() =>
      assertDisposableDatabase(PRODUCTION_URL, 'truncar as tabelas'),
    ).toThrow(/truncar as tabelas/);
  });
});

describe('classificação de host', () => {
  it('extrai o host da URL', () => {
    expect(hostOf(PRODUCTION_URL)).toBe('api.farmaciasprecodecusto.com.br');
    expect(hostOf(LOCAL_URL)).toBe('localhost');
    expect(hostOf('lixo')).toBe('');
  });

  it('reconhece subdomínio de produção', () => {
    expect(isKnownProductionHost('api.farmaciasprecodecusto.com.br')).toBe(true);
    expect(isKnownProductionHost('outro.farmaciasprecodecusto.com.br')).toBe(true);
    expect(isKnownProductionHost('10.1.4.82')).toBe(true);
  });

  it('não confunde host parecido com descartável', () => {
    expect(isDisposableHost('localhost.exemplo.com')).toBe(false);
    expect(isDisposableHost('')).toBe(false);
  });
});
