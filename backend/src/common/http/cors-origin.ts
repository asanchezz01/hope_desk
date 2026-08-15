/**
 * Política de origem do CORS.
 *
 * ## O problema que isto resolve
 *
 * `CORS_ORIGIN` guarda uma origem exata (`http://localhost:8081`). Abrir o
 * mesmo aplicativo por `http://127.0.0.1:8081` — o mesmo servidor, a mesma
 * máquina — produz uma origem DIFERENTE, e o navegador bloqueia todas as
 * chamadas.
 *
 * O sintoma é cruel: a especificação do fetch proíbe o navegador de contar ao
 * JavaScript que foi CORS, então o cliente recebe um erro de rede genérico e
 * mostra "Não foi possível conectar ao servidor". A pessoa vai conferir se a
 * API está no ar — e ela está. Aconteceu de verdade nesta migração.
 *
 * O mesmo vale para testar em aparelho: o emulador Android usa `10.0.2.2` e um
 * celular na rede usa o IP da máquina. Cada um é mais uma origem que ninguém
 * lembra de acrescentar na variável.
 *
 * ## A regra
 *
 * Em desenvolvimento, além do que estiver configurado, aceita qualquer origem
 * de **loopback ou rede privada** (RFC 1918). Em produção, só a lista
 * configurada — a relaxação não atravessa o `NODE_ENV`, e há teste para isso.
 */

type OriginCallback = (error: Error | null, allow?: boolean) => void;
export type CorsOriginOption =
  boolean | string[] | ((origin: string | undefined, callback: OriginCallback) => void);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * Faixas privadas da RFC 1918, mais o `10.0.2.2` do emulador Android.
 *
 * O host precisa ser um IPv4 COMPLETO antes de a faixa ser testada: sem isso,
 * `10.exemplo.com` casaria com `^10\.` e um domínio público seria aceito como
 * rede local. Tem teste para esse caso.
 */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const PRIVATE_IPV4 = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./];

export function isLocalNetworkOrigin(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (LOOPBACK_HOSTS.has(host)) return true;
  if (!IPV4.test(host)) return false;
  return PRIVATE_IPV4.some((range) => range.test(host));
}

export function resolveCorsOrigin(
  configuredOrigins: string[],
  allowLocalNetwork: boolean,
): CorsOriginOption {
  if (!allowLocalNetwork) {
    // Produção: lista exata. `false` quando não há nada configurado — negar é
    // o padrão seguro, e um CORS aberto por omissão seria pior que o erro.
    return configuredOrigins.length > 0 ? configuredOrigins : false;
  }

  return (origin, callback) => {
    // Sem `Origin`: curl, aplicativo nativo, requisição servidor-a-servidor.
    // Não é o navegador pedindo, então CORS não se aplica.
    if (!origin) return callback(null, true);

    if (configuredOrigins.includes(origin)) return callback(null, true);
    if (isLocalNetworkOrigin(origin)) return callback(null, true);

    callback(null, false);
  };
}
