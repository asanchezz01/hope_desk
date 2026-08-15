/**
 * A origem exata que ninguém lembra de configurar.
 *
 * `http://localhost:8081` e `http://127.0.0.1:8081` são o mesmo servidor e
 * origens diferentes. O navegador bloqueia a segunda e — por exigência da
 * especificação do fetch — não conta ao JavaScript que foi CORS: o cliente
 * mostra "não foi possível conectar ao servidor" e a investigação vai para o
 * lugar errado. Custou uma sessão inteira nesta migração.
 */
import { isLocalNetworkOrigin, resolveCorsOrigin } from './cors-origin';

const CONFIGURADAS = ['http://localhost:8081'];

/** Executa a política e devolve se a origem foi aceita. */
function permite(origem: string | undefined, allowLocalNetwork: boolean): boolean {
  const policy = resolveCorsOrigin(CONFIGURADAS, allowLocalNetwork);
  if (typeof policy !== 'function') {
    return Array.isArray(policy) ? policy.includes(origem ?? '') : policy;
  }

  let permitido = false;
  policy(origem, (_error, allow) => {
    permitido = allow === true;
  });
  return permitido;
}

describe('em desenvolvimento', () => {
  it('aceita a origem configurada', () => {
    expect(permite('http://localhost:8081', true)).toBe(true);
  });

  it('aceita 127.0.0.1 — o caso que quebrava', () => {
    expect(permite('http://127.0.0.1:8081', true)).toBe(true);
  });

  it('aceita o emulador Android e o IP da máquina na rede local', () => {
    expect(permite('http://10.0.2.2:8081', true)).toBe(true);
    expect(permite('http://192.168.0.14:8081', true)).toBe(true);
    expect(permite('http://172.16.5.9:19006', true)).toBe(true);
  });

  it('aceita qualquer porta local — o Metro troca de porta sozinho', () => {
    expect(permite('http://localhost:8082', true)).toBe(true);
  });

  it('recusa origem pública mesmo em desenvolvimento', () => {
    expect(permite('https://exemplo.com', true)).toBe(false);
    expect(permite('http://172.15.0.1:8081', true)).toBe(false); // fora da RFC 1918
  });

  it('aceita requisição sem Origin (curl, app nativo)', () => {
    // Não é o navegador pedindo; CORS não se aplica.
    expect(permite(undefined, true)).toBe(true);
  });
});

describe('em produção', () => {
  it('não relaxa nada: só a lista configurada', () => {
    expect(permite('http://localhost:8081', false)).toBe(true);
    expect(permite('http://127.0.0.1:8081', false)).toBe(false);
    expect(permite('http://10.0.2.2:8081', false)).toBe(false);
  });

  it('nega tudo quando não há origem configurada', () => {
    const policy = resolveCorsOrigin([], false);
    expect(policy).toBe(false);
  });
});

describe('isLocalNetworkOrigin', () => {
  it('reconhece loopback', () => {
    for (const origem of [
      'http://localhost:1',
      'http://127.0.0.1:2',
      'http://[::1]:3',
    ]) {
      expect(isLocalNetworkOrigin(origem)).toBe(true);
    }
  });

  it('recusa origem malformada em vez de estourar', () => {
    expect(isLocalNetworkOrigin('não é uma origem')).toBe(false);
    expect(isLocalNetworkOrigin('')).toBe(false);
  });

  it('não confunde host que apenas começa parecido', () => {
    expect(isLocalNetworkOrigin('http://localhost.exemplo.com')).toBe(false);
    expect(isLocalNetworkOrigin('http://10.exemplo.com')).toBe(false);
  });
});
