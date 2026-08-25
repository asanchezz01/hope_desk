/**
 * Janelas móveis do filtro de período.
 *
 * A lista é fechada de propósito: `lastDays` entra numa consulta de intervalo,
 * e um valor livre deixaria qualquer cliente pedir 30.000 dias. O espelho no
 * frontend é `src/domain/periods.ts` — os dois precisam concordar, senão a tela
 * oferece uma opção que a API recusa.
 */
export const LAST_DAYS_CHOICES = [30, 60, 90, 120] as const;

export type LastDays = (typeof LAST_DAYS_CHOICES)[number];
