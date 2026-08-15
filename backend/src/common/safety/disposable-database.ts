/**
 * Trava contra operar em base que não seja descartável.
 *
 * ## Por que virou lista de PERMISSÃO
 *
 * A versão anterior era uma lista de bloqueio duplicada em dois arquivos
 * (`prisma/seed.ts` e `test/setup-e2e.ts`) com os marcadores
 * `['farmacosprecodecusto.com.br', '10.1.4.82']`.
 *
 * O host real de produção é `api.farmaciasprecodecusto.com.br` —
 * "farmac**ias**", não "farmac**os**". A trava **nunca teria bloqueado nada**:
 * apontar `DATABASE_URL` para produção e rodar `npm run prisma:seed` gravaria
 * usuários lá, e rodar a suíte de integração executaria `truncateAll`, que
 * APAGA todas as tabelas. Descoberto na Fase 12, ao ler o `.env` do Flask.
 *
 * A lição não é "corrigir o marcador". É que uma lista de bloqueio erra em
 * silêncio e no sentido perigoso: o que ela não conhece, ela libera. Uma lista
 * de permissão erra no sentido seguro — o que ela não conhece, ela recusa, e
 * alguém percebe na hora.
 *
 * Os marcadores conhecidos continuam, agora como recusa **inegociável**: nem a
 * variável de escape os libera.
 */

/** Hosts onde escrever é inofensivo: tudo roda em container descartável. */
const DISPOSABLE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  // Nomes de serviço do docker-compose, usados quando o processo roda em container.
  'postgres',
  'postgres-test',
  'host.docker.internal',
]);

/**
 * Hosts de produção conhecidos. Recusa absoluta — `ALLOW_NON_LOCAL_DATABASE`
 * não vale para eles. Hostname não é segredo, e é por estarem escritos aqui
 * que a recusa funciona.
 */
const PRODUCTION_HOSTS = [
  'api.farmaciasprecodecusto.com.br',
  'farmaciasprecodecusto.com.br',
  '10.1.4.82',
];

/** Escape consciente, para quando o destino legítimo não for local. */
const ESCAPE_VARIABLE = 'ALLOW_NON_LOCAL_DATABASE';
const ESCAPE_VALUE = 'eu-confirmo';

export function hostOf(databaseUrl: string): string {
  try {
    // `postgresql://` não é um esquema que o WHATWG URL trate de forma
    // especial, mas `hostname` funciona igual — e um valor malformado cai no
    // catch e é tratado como desconhecido, que é recusado.
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isDisposableHost(host: string): boolean {
  if (!host) return false;
  if (PRODUCTION_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))) {
    return false;
  }
  return DISPOSABLE_HOSTS.has(host);
}

export function isKnownProductionHost(host: string): boolean {
  return PRODUCTION_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

/**
 * Lança se a URL não apontar para uma base descartável.
 *
 * @param operation descrição do que seria feito, para a mensagem de erro
 *   ("semear", "truncar as tabelas", "migrar os dados do legado").
 */
export function assertDisposableDatabase(
  databaseUrl: string | undefined,
  operation: string,
): void {
  if (!databaseUrl) {
    throw new Error(`Recusando ${operation}: DATABASE_URL não definida.`);
  }

  const host = hostOf(databaseUrl);

  if (isKnownProductionHost(host)) {
    throw new Error(
      `Recusando ${operation}: "${host}" é um host de PRODUÇÃO conhecido. ` +
        `Esta recusa não pode ser desligada.`,
    );
  }

  if (isDisposableHost(host)) return;

  if (process.env[ESCAPE_VARIABLE] === ESCAPE_VALUE) return;

  throw new Error(
    `Recusando ${operation}: "${host || '(host ilegível)'}" não está na lista de ` +
      `destinos descartáveis (${[...DISPOSABLE_HOSTS].join(', ')}). ` +
      `Se o destino for mesmo intencional, defina ${ESCAPE_VARIABLE}=${ESCAPE_VALUE}.`,
  );
}
