import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseWallClockInput } from '../common/time/legacy-clock';
import {
  calculateHoursBank,
  calculatePaidHoursForMonth,
  HoursBankInput,
} from './hours-bank.calculator';

/**
 * Paridade com o Flask, caso a caso.
 *
 * Os valores esperados não foram escritos à mão: vêm de
 * `scripts/gen_hours_bank_golden.py`, que **executa** o
 * `calculate_accumulated_hours` do `app.py` com a camada de consulta
 * substituída por listas em memória.
 *
 * Regerar depois de qualquer mudança no legado:
 *   .venv/Scripts/python.exe scripts/gen_hours_bank_golden.py
 */

interface GoldenCase {
  name: string;
  role: string;
  userId: number;
  monthlyHoursAllowance: string;
  hoursBankClosingDate: string;
  reference: string;
  activities: { startedAt: string; endedAt: string; clientId: number }[];
  payments: { paidAt: string; paidHours: string }[];
  paidHoursMonth?: [number, number];
  expected: {
    netAccumulatedHours: number;
    paidHoursInCycle: number;
    franchiseHours: number;
    cycleStart: string;
    cycleEnd: string;
    paidHoursInMonth?: number;
  };
}

const golden: { generatedBy: string; cases: GoldenCase[] } = JSON.parse(
  readFileSync(join(__dirname, '../../test/fixtures/hours-bank-golden.json'), 'utf8'),
);

/** Converte AAAA-MM-DD numa data pura, como o banco guarda `paid_at`. */
function parseDateOnly(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Monta a entrada do calculador a partir do caso dourado, aplicando o mesmo
 * escopo por cliente que o service aplica no `WHERE` do SQL.
 */
function toInput(testCase: GoldenCase): HoursBankInput {
  const activities = testCase.activities
    .filter((item) => testCase.role !== 'client' || item.clientId === testCase.userId)
    .map((item) => ({
      startedAt: parseWallClockInput(item.startedAt),
      endedAt: parseWallClockInput(item.endedAt),
    }));

  return {
    monthlyHoursAllowanceRaw: testCase.monthlyHoursAllowance,
    hoursBankClosingDateRaw: testCase.hoursBankClosingDate,
    reference: parseWallClockInput(testCase.reference),
    activities,
    payments: testCase.payments.map((item) => ({
      paidAt: parseDateOnly(item.paidAt),
      // A vírgula decimal é normalizada na borda (Fase 03); aqui já chega ponto.
      paidHours: String(item.paidHours).replace(',', '.'),
    })),
  };
}

describe('Banco de horas — paridade com o Flask', () => {
  it('carregou os casos gerados pelo legado', () => {
    expect(golden.generatedBy).toMatch(/app\.py do legado/);
    expect(golden.cases.length).toBeGreaterThanOrEqual(30);
  });

  describe.each(golden.cases.map((testCase) => [testCase.name, testCase] as const))(
    'caso: %s',
    (_name, testCase) => {
      const result = () => calculateHoursBank(toInput(testCase));

      it('saldo líquido acumulado bate com o Flask', () => {
        expect(result().netAccumulatedHours).toBeCloseTo(
          testCase.expected.netAccumulatedHours,
          2,
        );
      });

      it('horas pagas no ciclo batem com o Flask', () => {
        expect(result().paidHoursInCycle).toBeCloseTo(
          testCase.expected.paidHoursInCycle,
          2,
        );
      });

      it('franquia efetiva bate com o Flask', () => {
        expect(result().franchiseHours).toBeCloseTo(
          testCase.expected.franchiseHours,
          2,
        );
      });

      it('janela do ciclo bate com o Flask', () => {
        const { cycleStart, cycleEnd } = result();
        // O legado serializa datetime naive; comparamos a parede armazenada.
        expect(cycleStart.toISOString().slice(0, 19)).toBe(
          testCase.expected.cycleStart.slice(0, 19),
        );
        expect(cycleEnd.toISOString().slice(0, 19)).toBe(
          testCase.expected.cycleEnd.slice(0, 19),
        );
      });

      if (testCase.paidHoursMonth) {
        it('horas pagas no mês batem com o Flask (limite superior exclusivo)', () => {
          const [year, month] = testCase.paidHoursMonth!;
          const payments = toInput(testCase).payments;
          expect(calculatePaidHoursForMonth(payments, year, month)).toBeCloseTo(
            testCase.expected.paidHoursInMonth!,
            2,
          );
        });
      }
    },
  );

  it('o saldo líquido nunca é negativo em nenhum caso dourado', () => {
    for (const testCase of golden.cases) {
      expect(
        calculateHoursBank(toInput(testCase)).netAccumulatedHours,
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
