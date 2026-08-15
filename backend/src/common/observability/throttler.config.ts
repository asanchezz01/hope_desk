import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate limiting (Fase 11).
 *
 * Armazenamento **em memória**, de propósito: o roadmap pede para não
 * acrescentar Redis sem justificar, e a aplicação roda em instância única. A
 * consequência precisa ficar registrada: com mais de uma instância, cada uma
 * conta separadamente, e o limite efetivo vira `limite × instâncias`. Escalar
 * horizontalmente exige trocar o storage — e é aí que o Redis passa a se
 * justificar.
 *
 * Dois níveis, porque protegem de coisas diferentes:
 *
 * - `default` cobre a API inteira contra varredura e uso abusivo;
 * - as rotas de autenticação são bem mais apertadas. O login é o alvo de força
 *   bruta, e a Fase 02 fechou o canal lateral de LATÊNCIA (`spendDummyWork`)
 *   mas não limitava a TAXA de tentativas — que é o que isto resolve.
 *
 * ## Por que os limites vêm do ambiente
 *
 * A suíte de integração faz dezenas de logins seguidos e bateria no limite,
 * transformando testes de autenticação em testes de rate limiting. Em vez de
 * desligar o guard em teste — o que deixaria o recurso sem cobertura —, os
 * limites são configuráveis: a suíte geral sobe o teto, e um spec dedicado o
 * abaixa para verificar o 429 de verdade.
 */
function limitFrom(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const THROTTLER_CONFIG: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'default',
      ttl: 60_000,
      limit: limitFrom('THROTTLE_DEFAULT_LIMIT', 120),
    },
  ],
};

/** Limite das rotas de autenticação, aplicado com `@Throttle`. */
export const AUTH_THROTTLE = {
  default: { limit: limitFrom('THROTTLE_AUTH_LIMIT', 10), ttl: 60_000 },
} as const;

/**
 * Recuperação de senha: mais apertado ainda. Cada tentativa dispara um e-mail,
 * então o abuso vira spam contra um terceiro, não só carga no servidor.
 */
export const PASSWORD_RESET_THROTTLE = {
  default: { limit: limitFrom('THROTTLE_PASSWORD_RESET_LIMIT', 3), ttl: 300_000 },
} as const;
