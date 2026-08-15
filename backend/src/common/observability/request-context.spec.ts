import {
  getCorrelationId,
  getRequestContext,
  normalizeCorrelationId,
  runWithRequestContext,
  setRequestUser,
} from './request-context';

describe('normalizeCorrelationId', () => {
  it('aceita um ID vindo de fora quando ele é seguro', () => {
    // Aceitar o ID do cliente permite rastrear a chamada através de um proxy.
    const id = 'req-01HXYZ_abc.123';
    expect(normalizeCorrelationId(id)).toBe(id);
  });

  it('rejeita quebras de linha — o vetor de forja de log', () => {
    // Sem isto, `X-Request-Id: a\n{"level":"error","message":"..."}` injetaria
    // uma linha inteira no log estruturado, forjando um evento que não houve.
    const forged = normalizeCorrelationId('abc123\n{"level":"error"}');
    expect(forged).not.toContain('\n');
    expect(forged).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejeita valores curtos, longos demais ou com caracteres fora do conjunto', () => {
    for (const invalid of [
      'curto',
      'a'.repeat(200),
      'com espaço',
      'com/barra',
      '<script>',
    ]) {
      expect(normalizeCorrelationId(invalid)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('gera um ID quando não vem nada', () => {
    for (const missing of [undefined, null, 42, {}, []]) {
      expect(normalizeCorrelationId(missing)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('gera IDs distintos a cada chamada', () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => normalizeCorrelationId(undefined)),
    );
    expect(ids.size).toBe(50);
  });
});

describe('contexto por requisição', () => {
  it('devolve undefined fora de uma requisição', () => {
    // Boot, seed e teste rodam sem contexto; nada pode quebrar por isso.
    expect(getRequestContext()).toBeUndefined();
    expect(getCorrelationId()).toBeUndefined();
  });

  it('isola contextos concorrentes', async () => {
    // É o ponto todo do AsyncLocalStorage: duas requisições simultâneas não
    // podem ver o correlation ID uma da outra.
    const observed: string[] = [];

    async function handle(id: string, delay: number): Promise<void> {
      await runWithRequestContext({ correlationId: id }, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        observed.push(getCorrelationId() as string);
      });
    }

    await Promise.all([handle('primeiro-1234', 20), handle('segundo-1234', 5)]);

    expect(observed.sort()).toEqual(['primeiro-1234', 'segundo-1234']);
  });

  it('sobrevive ao await — o caso dos handlers de evento', () => {
    return runWithRequestContext({ correlationId: 'contexto-1234' }, async () => {
      await Promise.resolve();
      await new Promise((resolve) => setImmediate(resolve));
      // Um handler de notificação roda depois do commit, fora da pilha do
      // controller; sem isto o log dele ficaria órfão.
      expect(getCorrelationId()).toBe('contexto-1234');
    });
  });

  it('anexa o usuário depois que o guard autentica', () => {
    runWithRequestContext({ correlationId: 'contexto-1234' }, () => {
      expect(getRequestContext()?.userId).toBeUndefined();
      setRequestUser(7);
      expect(getRequestContext()?.userId).toBe(7);
    });
  });

  it('não quebra ao anexar usuário fora de contexto', () => {
    expect(() => setRequestUser(7)).not.toThrow();
  });
});
