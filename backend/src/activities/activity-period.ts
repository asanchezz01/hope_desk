import { durationHours } from '../common/time/legacy-clock';

/**
 * Regras temporais das atividades — funções **puras**.
 *
 * De `validate_activity_period` e `find_activity_conflict` do legado
 * (docs/LEGACY_CONTRACTS.md §9).
 */

/** Duração máxima de uma atividade. `> 12` rejeita; exatamente 12 aceita. */
export const MAX_ACTIVITY_HOURS = 12;

export const PERIOD_ORDER_MESSAGE =
  'A data/hora de término deve ser posterior à data/hora de início.';

export const PERIOD_DURATION_MESSAGE =
  'A duração da atividade não pode ser superior a 12 horas.';

/**
 * `validate_activity_period`: devolve a mensagem de erro ou `null`.
 *
 * Duas regras, nesta ordem:
 *   1. `ended_at > started_at` **estritamente** — igual é inválido;
 *   2. duração de no máximo 12 horas.
 */
export function validateActivityPeriod(startedAt: Date, endedAt: Date): string | null {
  if (endedAt.getTime() <= startedAt.getTime()) {
    return PERIOD_ORDER_MESSAGE;
  }

  const duration = (endedAt.getTime() - startedAt.getTime()) / 3_600_000;
  if (duration > MAX_ACTIVITY_HOURS) {
    return PERIOD_DURATION_MESSAGE;
  }

  return null;
}

export interface ActivityInterval {
  id: number;
  startedAt: Date;
  endedAt: Date;
}

/**
 * Predicado de sobreposição do legado:
 *
 * ```python
 * Activity.started_at < ended_at AND Activity.ended_at > started_at
 * ```
 *
 * Ambas as comparações são **estritas**, então intervalos **adjacentes não
 * conflitam**: uma atividade que termina 10:00 e outra que começa 10:00
 * convivem.
 */
export function intervalsOverlap(
  left: { startedAt: Date; endedAt: Date },
  right: { startedAt: Date; endedAt: Date },
): boolean {
  return (
    left.startedAt.getTime() < right.endedAt.getTime() &&
    left.endedAt.getTime() > right.startedAt.getTime()
  );
}

/**
 * `find_activity_conflict`: primeira atividade sobreposta do **mesmo técnico**,
 * em ordem de `started_at` ascendente.
 *
 * `candidates` já deve vir filtrado por técnico. `excludeActivityId` remove a
 * própria atividade durante a edição.
 *
 * O escopo é **global por técnico**: atravessa chamados, dias e meses.
 */
export function findActivityConflict(
  candidates: ActivityInterval[],
  startedAt: Date,
  endedAt: Date,
  excludeActivityId?: number,
): ActivityInterval | null {
  const conflicts = candidates
    .filter((candidate) => candidate.id !== excludeActivityId)
    .filter((candidate) => intervalsOverlap(candidate, { startedAt, endedAt }))
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());

  return conflicts[0] ?? null;
}

/** Duração em horas, arredondada a 2 casas, como `duration_hours` do legado. */
export function activityDurationHours(startedAt: Date, endedAt: Date): number {
  const hours = durationHours(startedAt, endedAt);
  return Math.round((hours + Number.EPSILON) * 100) / 100;
}
